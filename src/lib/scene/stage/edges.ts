import { defaults } from '../../../config/stage';
import type { Bounds3 } from '../../core/geometry';
import {
	GreaterDepth,
	type OrthographicCamera,
	InstancedBufferAttribute,
	type Node,
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

type Edge = {
	start: number;
	end: number;
	front: Vector3;
	back?: Vector3;
	frontTriangle?: readonly number[];
	backTriangle?: readonly number[];
};
type EdgeFaces = { fronts: number[]; backs: number[] };
const xyzComponents = /* Exact arithmetic: XYZ components per vertex. */ 3;
const triangleVertices = /* Exact arithmetic: vertices per triangle. */ 3;
const planNormal = /* Exact arithmetic: a plan edge has an upward unit normal. */ [
	0, 0, 1
] as const;
const weldPerMeter = defaults.stageEdgeWeldPerM;
const creaseDot = Math.cos(defaults.stageCreaseAngleRad);

export function creases(
	positions: readonly number[],
	indices: readonly number[],
	creaseAngleRad?: number,
	vertices?: number[],
	faces?: EdgeFaces
): Edges {
	const limit = creaseAngleRad === undefined ? creaseDot : Math.cos(creaseAngleRad);
	const edges = new Map<string, Edge>();
	const keys = new Map<number, string>();
	const a = new Vector3();
	const b = new Vector3();
	const c = new Vector3();

	function keyAt(index: number) {
		let key = keys.get(index);
		if (key === undefined) {
			key = vertexKey(positions, index * xyzComponents);
			keys.set(index, key);
		}
		return key;
	}

	for (let i = 0; i < indices.length; i += triangleVertices) {
		const triangle = [indices[i], indices[i + 1], indices[i + 2]];
		a.fromArray(positions, triangle[0] * xyzComponents);
		b.fromArray(positions, triangle[1] * xyzComponents);
		c.fromArray(positions, triangle[2] * xyzComponents);
		b.sub(a).cross(c.sub(a)).normalize();
		if (!b.lengthSq()) continue;
		const front = b.clone();
		for (let j = 0; j < triangleVertices; j += 1) {
			const start = triangle[j];
			const end = triangle[(j + 1) % triangleVertices];
			const from = keyAt(start);
			const to = keyAt(end);
			const key = from < to ? from + '/' + to : to + '/' + from;
			const edge = edges.get(key);
			if (edge) {
				if (!edge.back) {
					edge.back = front;
					if (faces) edge.backTriangle = triangle;
				}
			} else {
				edges.set(key, { start, end, front, frontTriangle: faces ? triangle : undefined });
			}
		}
	}
	const segments: number[] = [];
	const fronts = [];
	const backs = [];
	for (const { start, end, front, back, frontTriangle, backTriangle } of edges.values()) {
		if (back && front.dot(back) > limit) continue;
		appendPoint(segments, positions, start);
		appendPoint(segments, positions, end);
		vertices?.push(start, end);
		fronts.push(front.x, front.y, front.z);
		const other = back ?? front;
		backs.push(other.x, other.y, other.z);
		if (faces && frontTriangle) {
			faces.fronts.push(...frontTriangle);
			faces.backs.push(...(backTriangle ?? frontTriangle));
		}
	}
	return { segments, fronts, backs, vertices, faces };
}

export type Edges = {
	segments: number[];
	fronts: number[];
	backs: number[];
	vertices?: number[];
	faces?: EdgeFaces;
};

type LineArrays = Edges | { segments: Float32Array; fronts: Float32Array; backs: Float32Array };

function floatArray(values: number[] | Float32Array) {
	return values instanceof Float32Array ? values : new Float32Array(values);
}

export function lineGeometry({ segments, fronts, backs }: LineArrays) {
	const geometry = new LineSegmentsGeometry().setPositions(segments);
	if (fronts.length) {
		geometry.setAttribute(
			'edgeFront',
			new InstancedBufferAttribute(floatArray(fronts), xyzComponents)
		);
		geometry.setAttribute(
			'edgeBack',
			new InstancedBufferAttribute(floatArray(backs), xyzComponents)
		);
	}
	return geometry;
}

export function edgeGeometry(
	positions: readonly number[],
	indices: readonly number[],
	creaseAngleRad?: number
) {
	return lineGeometry(creases(positions, indices, creaseAngleRad));
}

function appendPoint(output: number[], positions: readonly number[], index: number) {
	const i = index * xyzComponents;
	output.push(positions[i], positions[i + 1], positions[i + 2]);
}

function vertexKey(positions: readonly number[], i: number) {
	return `${Math.round(positions[i] * weldPerMeter)},${Math.round(positions[i + 1] * weldPerMeter)},${Math.round(positions[i + 2] * weldPerMeter)}`;
}

function weldVertices(positions: readonly number[]) {
	const keys = new Map<string, number>();
	const welded = new Array<number>(positions.length / 3);
	for (let i = 0; i < welded.length; i++) {
		const key = vertexKey(positions, i * xyzComponents);
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
		for (let side = 0; side < triangleVertices; side++) {
			const a = indices[i + side];
			const b = indices[i + ((side + 1) % triangleVertices)];
			if (a === b) continue;
			const key = edgeKey(a, b, vertexCount);
			if (!edges.delete(key)) edges.add(key);
		}
	}
	return edges;
}

export function boundaries(
	positions: readonly number[],
	indices: readonly number[],
	perCell = false,
	vertices?: number[]
): Edges {
	if (!indices.length) return { segments: [], fronts: [], backs: [] };
	const welded = weldVertices(positions);
	// With separate cell indices, extract each rim before deduplicating shared segments.
	const edges = openEdges(perCell ? indices : indices.map((index) => welded[index]), welded.length);
	const segments: number[] = [];
	const normals = [];
	const drawn = new Set<number>();
	for (const key of edges) {
		const a = welded[Math.floor(key / welded.length)];
		const b = welded[key % welded.length];
		const segment = edgeKey(a, b, welded.length);
		if (a === b || drawn.has(segment)) continue;
		drawn.add(segment);
		appendPoint(segments, positions, a);
		appendPoint(segments, positions, b);
		normals.push(...planNormal);
		vertices?.push(a, b);
	}
	return { segments, fronts: normals, backs: normals, vertices };
}

export function strokeMaterials(landscape = false) {
	const eye = uniform(new Vector3());
	const front = attribute('edgeFront', 'vec3')
		.dot(eye)
		.greaterThan(defaults.stageEdgeFacingTolerance);
	const back = attribute('edgeBack', 'vec3')
		.dot(eye)
		.greaterThan(defaults.stageEdgeFacingTolerance);
	const silhouette = front.and(back.not()).or(back.and(front.not()));
	const options = { depthWrite: false, transparent: true };
	const pencilBias = landscape
		? { polygonOffset: true, polygonOffsetUnits: defaults.stageTerrainPencilDepthBias }
		: {};
	const outer = new Line2NodeMaterial({ ...options, linewidth: defaults.stageOuterStrokePx });
	const crease = new Line2NodeMaterial({
		...options,
		...pencilBias,
		linewidth: landscape
			? defaults.stageLandscapeCreaseStrokePx
			: defaults.stageObjectCreaseStrokePx
	});
	const gridDepth = {
		// The screen-space ribbon extends beyond the terrain-draped centerline.
		polygonOffset: true,
		polygonOffsetFactor: defaults.stageGridDepthFactor,
		polygonOffsetUnits: defaults.stageGridDepthBias,
		// Rasterized coverage keeps shared caps solid where the drape crosses triangles.
		alphaToCoverage: false
	};
	const grid = new Line2NodeMaterial({
		...options,
		...gridDepth,
		linewidth: defaults.stageGridStrokePx
	});
	const gridBoundary = new Line2NodeMaterial({
		...options,
		...gridDepth,
		linewidth: defaults.stageGridBoundaryStrokePx
	});
	const ground = new Line2NodeMaterial({ ...options, linewidth: defaults.stageGroundStrokePx });
	outer.maskNode = silhouette;
	crease.maskNode = silhouette.not();
	// Explicit strokes lie on faces; `pull` lifts them toward the eye in meters so the face in
	// front of them decides visibility, and `near` and `far` bound the picture's view depth.
	const depth = {
		pull: uniform(/* Exact arithmetic: zero initial depth pull, near plane or recession. */ 0),
		near: uniform(/* Exact arithmetic: zero initial depth pull, near plane or recession. */ 0),
		far: uniform(/* Exact arithmetic: normalized far plane ends at one. */ 1)
	};
	return {
		eye,
		silhouette,
		outer,
		crease,
		grid,
		gridBoundary,
		ground,
		depth,
		materials: new Set([outer, crease, grid, gridBoundary, ground])
	};
}

/** One explicit stroke layer: the visible pass, or the hidden pass drawn only where a nearer
 * surface covers the stroke. `recede` lightens strokes with their view depth. */
export function explicitStroke(
	depth: ReturnType<typeof strokeMaterials>['depth'],
	hidden = false,
	style?: { color: Node<'vec3'>; recede: Node<'float'> }
) {
	const material = new Line2NodeMaterial({
		transparent: true,
		blending: NormalBlending,
		depthWrite: false,
		alphaToCoverage: false,
		linewidth: defaults.stageExplicitStrokePx
	});
	if (hidden) material.depthFunc = GreaterDepth;
	const recede = uniform(
		/* Exact arithmetic: zero initial depth pull, near plane or recession. */ 0
	);
	const distance = positionView.z
		.negate()
		.sub(depth.near)
		.div(depth.far.sub(depth.near).max(defaults.stageStrokeDepthFloor))
		.clamp(
			/* Exact arithmetic: lower bound of a unit interval. */ 0,
			/* Exact arithmetic: upper bound of a unit interval. */ 1
		);
	// Keep line coverage but blend the ink into all preceding layers, including other translucent fills.
	material.outputNode = vec4(
		style?.color ?? materialColor,
		diffuseColor.a.mul(distance.mul(style?.recede ?? recede).oneMinus())
	);
	material.depthNode = viewZToOrthographicDepth(
		positionView.z.add(depth.pull),
		cameraNear,
		cameraFar
	);
	return { material, recede };
}

/** Strokes on a face are lifted about two and a half CSS pixels toward the eye. */
const strokePullPx = defaults.stageStrokePullPx;

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
