import type { Bounds3 } from '../../core/geometry';
import {
	GreaterDepth,
	type OrthographicCamera,
	InstancedBufferAttribute,
	Line2NodeMaterial,
	NormalBlending,
	Vector3
} from 'three/webgpu';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import {
	attribute,
	cameraFar,
	cameraNear,
	diffuseColor,
	materialColor,
	positionView,
	uniform,
	vec4,
	viewZToOrthographicDepth
} from 'three/tsl';

type Edge = { start: Vector3; end: Vector3; front: Vector3; back?: Vector3 };
const weldPerMeter = 10_000;
const creaseDot = Math.cos(Math.PI / 180);

export function edgeGeometry(
	positions: readonly number[],
	indices: readonly number[],
	creaseAngleRad?: number
) {
	const limit = creaseAngleRad === undefined ? creaseDot : Math.cos(creaseAngleRad);
	const edges = new Map<string, Edge>();
	for (let i = 0; i < indices.length; i += 3) {
		const points = indices
			.slice(i, i + 3)
			.map((index) => new Vector3().fromArray(positions, index * 3));
		const [a, b, c] = points;
		const front = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
		if (!front.lengthSq()) continue;
		const keys = points.map((point) =>
			point
				.toArray()
				.map((x) => Math.round(x * weldPerMeter))
				.join(',')
		);
		for (let j = 0; j < 3; j += 1) {
			const next = (j + 1) % 3;
			const key = [keys[j], keys[next]].sort().join('/');
			const edge = edges.get(key);
			if (edge) edge.back ??= front;
			else edges.set(key, { start: points[j], end: points[next], front });
		}
	}
	const segments = [];
	const fronts = [];
	const backs = [];
	for (const { start, end, front, back } of edges.values()) {
		if (back && front.dot(back) > limit) continue;
		segments.push(...start.toArray(), ...end.toArray());
		fronts.push(...front.toArray());
		backs.push(...(back ?? front).toArray());
	}
	const geometry = new LineSegmentsGeometry().setPositions(segments);
	geometry.setAttribute('edgeFront', new InstancedBufferAttribute(new Float32Array(fronts), 3));
	geometry.setAttribute('edgeBack', new InstancedBufferAttribute(new Float32Array(backs), 3));
	return geometry;
}

function weldVertices(positions: readonly number[]) {
	const keys = new Map<string, number>();
	const welded = new Array<number>(positions.length / 3);
	for (let i = 0; i < welded.length; i++) {
		const base = i * 3;
		const key = positions
			.slice(base, base + 3)
			.map((value) => Math.round(value * weldPerMeter))
			.join(',');
		const existing = keys.get(key);
		if (existing === undefined) keys.set(key, i);
		welded[i] = existing ?? i;
	}
	return welded;
}

function edgeKey(a: number, b: number, vertexCount: number) {
	return Math.min(a, b) * vertexCount + Math.max(a, b);
}

function openEdges(indices: readonly number[], vertexCount: number) {
	const edges = new Set<number>();
	for (let i = 0; i < indices.length; i += 3) {
		for (let side = 0; side < 3; side++) {
			const a = indices[i + side];
			const b = indices[i + ((side + 1) % 3)];
			if (a === b) continue;
			const key = edgeKey(a, b, vertexCount);
			if (!edges.delete(key)) edges.add(key);
		}
	}
	return edges;
}

export function boundaryGeometry(
	positions: readonly number[],
	indices: readonly number[],
	perCell = false
) {
	const geometry = new LineSegmentsGeometry();
	if (!indices.length) return geometry.setPositions([]);
	const welded = weldVertices(positions);
	// With separate cell indices, extract each rim before deduplicating shared segments.
	const edges = openEdges(perCell ? indices : indices.map((index) => welded[index]), welded.length);
	const segments = [];
	const normals = [];
	const drawn = new Set<number>();
	for (const key of edges) {
		const a = welded[Math.floor(key / welded.length)];
		const b = welded[key % welded.length];
		const segment = edgeKey(a, b, welded.length);
		if (a === b || drawn.has(segment)) continue;
		drawn.add(segment);
		segments.push(...positions.slice(a * 3, a * 3 + 3), ...positions.slice(b * 3, b * 3 + 3));
		normals.push(0, 0, 1);
	}
	geometry.setPositions(segments);
	const normal = new InstancedBufferAttribute(new Float32Array(normals), 3);
	geometry.setAttribute('edgeFront', normal);
	geometry.setAttribute('edgeBack', normal);
	return geometry;
}

export function strokeMaterials(landscape = false) {
	const eye = uniform(new Vector3());
	const front = attribute('edgeFront', 'vec3').dot(eye).greaterThan(1e-5);
	const back = attribute('edgeBack', 'vec3').dot(eye).greaterThan(1e-5);
	const silhouette = front.and(back.not()).or(back.and(front.not()));
	const options = { depthWrite: false, transparent: true };
	const pencilBias = landscape ? { polygonOffset: true, polygonOffsetUnits: -96 } : {};
	const outer = new Line2NodeMaterial({ ...options, linewidth: 1.4 });
	const crease = new Line2NodeMaterial({
		...options,
		...pencilBias,
		linewidth: landscape ? 1.35 : 0.75
	});
	const gridDepth = {
		// The screen-space ribbon extends beyond the terrain-draped centerline.
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -16384,
		// Rasterized coverage keeps shared caps solid where the drape crosses triangles.
		alphaToCoverage: false
	};
	const grid = new Line2NodeMaterial({ ...options, ...gridDepth, linewidth: 1.5 });
	const gridBoundary = new Line2NodeMaterial({ ...options, ...gridDepth, linewidth: 2.5 });
	const ground = new Line2NodeMaterial({ ...options, linewidth: 0.75 });
	outer.maskNode = silhouette;
	crease.maskNode = silhouette.not();
	// Explicit strokes lie on faces; `pull` lifts them toward the eye in meters so the face in
	// front of them decides visibility, and `near` and `far` bound the picture's view depth.
	const depth = { pull: uniform(0), near: uniform(0), far: uniform(1) };
	return { eye, outer, crease, grid, gridBoundary, ground, depth };
}

/** One explicit stroke layer: the visible pass, or the hidden pass drawn only where a nearer
 * surface covers the stroke. `recede` lightens strokes with their view depth. */
export function explicitStroke(depth: ReturnType<typeof strokeMaterials>['depth'], hidden = false) {
	const material = new Line2NodeMaterial({
		transparent: true,
		blending: NormalBlending,
		depthWrite: false,
		alphaToCoverage: false,
		linewidth: 1
	});
	if (hidden) material.depthFunc = GreaterDepth;
	const recede = uniform(0);
	const distance = positionView.z
		.negate()
		.sub(depth.near)
		.div(depth.far.sub(depth.near).max(1e-3))
		.clamp(0, 1);
	// Keep line coverage but blend the ink into all preceding layers, including other translucent fills.
	material.outputNode = vec4(materialColor, diffuseColor.a.mul(distance.mul(recede).oneMinus()));
	material.depthNode = viewZToOrthographicDepth(
		positionView.z.add(depth.pull),
		cameraNear,
		cameraFar
	);
	return { material, recede };
}

/** Strokes on a face are lifted about two and a half CSS pixels toward the eye. */
const strokePullPx = 2.5;

/** Sets the stroke lift and the view-depth range of the visible bounds for one frame. */
export function setStrokeDepth(
	strokes: ReturnType<typeof strokeMaterials>,
	camera: OrthographicCamera,
	{ min, max }: Bounds3,
	metersPerPixel: number
) {
	const [ex, ey, ez] = strokes.eye.value.toArray();
	const { x, y, z } = camera.position;
	let near = Infinity;
	let far = -Infinity;
	for (const cx of [min[0], max[0]])
		for (const cy of [min[1], max[1]])
			for (const cz of [min[2], max[2]]) {
				const depth = -((cx - x) * ex + (cy - y) * ey + (cz - z) * ez);
				near = Math.min(near, depth);
				far = Math.max(far, depth);
			}
	strokes.depth.near.value = near;
	strokes.depth.far.value = far;
	strokes.depth.pull.value = strokePullPx * metersPerPixel;
}
