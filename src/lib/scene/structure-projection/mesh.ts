import { BoxGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import type { Vec3 } from '../../core/geometry';

// Exact arithmetic: the positive Z unit vector is the box length axis.
const vertical = new Vector3(0, 0, 1);
// Exact arithmetic: the midpoint lies halfway between the ends.
const half = 0.5;
const cube = new BoxGeometry();
const vertices = cube.getAttribute('position');
const triangles = cube.getIndex();

export type Mesh = { positions: number[]; indices: number[]; segments: number[] };

export function mesh(): Mesh {
	return { positions: [], indices: [], segments: [] };
}

/** Appends a square-profile segment and optionally its centerline. */
export function addSegment(mesh: Mesh, from: Vec3, to: Vec3, width: number, stroke: boolean) {
	const start = new Vector3(...from);
	const end = new Vector3(...to);
	const vector = end.clone().sub(start);
	const length = vector.length();
	const mid = start.lerp(end, half);
	const rotation = new Quaternion().setFromUnitVectors(vertical, vector.normalize());
	const transform = new Matrix4().compose(mid, rotation, new Vector3(width, width, length));
	const index = mesh.positions.length / 3;
	const vertex = new Vector3();
	for (let i = 0; i < vertices.count; i++) {
		vertex.fromBufferAttribute(vertices, i).applyMatrix4(transform);
		mesh.positions.push(vertex.x, vertex.y, vertex.z);
	}
	if (triangles)
		for (let i = 0; i < triangles.count; i++) mesh.indices.push(index + triangles.getX(i));
	if (stroke) mesh.segments.push(...from, ...to);
}
