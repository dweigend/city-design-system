import { InstancedBufferAttribute, Line2NodeMaterial, Vector3 } from 'three/webgpu';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { attribute, uniform } from 'three/tsl';

type Edge = { start: Vector3; end: Vector3; front: Vector3; back?: Vector3 };
const weldPerMeter = 10_000;
const creaseDot = Math.cos(Math.PI / 180);

export function edgeGeometry(
	positions: readonly number[],
	indices: readonly number[],
	boundaryOnly = false
) {
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
		if (back && (boundaryOnly || front.dot(back) > creaseDot)) continue;
		segments.push(...start.toArray(), ...end.toArray());
		fronts.push(...front.toArray());
		backs.push(...(back ?? front).toArray());
	}
	const geometry = new LineSegmentsGeometry().setPositions(segments);
	geometry.setAttribute('edgeFront', new InstancedBufferAttribute(new Float32Array(fronts), 3));
	geometry.setAttribute('edgeBack', new InstancedBufferAttribute(new Float32Array(backs), 3));
	return geometry;
}

export function strokeMaterials(landscape = false) {
	const eye = uniform(new Vector3());
	const front = attribute('edgeFront', 'vec3').dot(eye).greaterThan(1e-5);
	const back = attribute('edgeBack', 'vec3').dot(eye).greaterThan(1e-5);
	const silhouette = front.and(back.not()).or(back.and(front.not()));
	const options = { depthWrite: false, transparent: true, depthTest: !landscape };
	const outer = new Line2NodeMaterial({ ...options, linewidth: 1.4 });
	const crease = new Line2NodeMaterial({ ...options, linewidth: landscape ? 0.95 : 0.75 });
	const ground = new Line2NodeMaterial({ ...options, linewidth: 0.75 });
	outer.maskNode = silhouette;
	crease.maskNode = silhouette.not();
	return { eye, outer, crease, ground };
}
