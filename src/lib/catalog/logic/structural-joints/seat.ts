import type { Vec3 } from '../traeger';
import type { JointMesh } from './geometry';

function cross([x, y, z]: Vec3, [u, v, w]: Vec3): Vec3 {
	return [y * w - z * v, z * u - x * w, x * v - y * u];
}

function dot(a: Vec3, b: Vec3) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Constructs the local X axis perpendicular to the normalized member axis. */
export function seatTangent(axis: Vec3): Vec3 {
	const x = cross(Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1], axis);
	const length = Math.hypot(...x);
	return [x[0] / length, x[1] / length, x[2] / length];
}

/** Fits the underside to the surveyed plane by translating along the member at each radial point. */
export function fitSeat(meshes: JointMesh[], axis: Vec3, tangent: Vec3, normal: Vec3) {
	const rise = dot(axis, normal);
	if (!(rise > 0) || !Number.isFinite(Math.hypot(...normal)))
		throw new RangeError('Member must emerge from its support plane');
	const dx = dot(normal, tangent) / rise;
	const dy = dot(normal, cross(axis, tangent)) / rise;
	for (const mesh of meshes) {
		for (const point of mesh.points) point[2] -= dx * point[0] + dy * point[1];
	}
}
