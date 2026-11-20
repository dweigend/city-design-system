import { interpolatePoint, type Vec3 } from '../parametrik/types';

/** Cumulative three-dimensional station distances in metres. */
export function chainage(path: readonly Vec3[]) {
	const distances = [0];
	for (let i = 1; i < path.length; i++) {
		const a = path[i - 1],
			b = path[i];
		distances.push(distances[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
	}
	return distances;
}
/** Index of the span containing a station distance. */
export function segment(distances: readonly number[], s: number) {
	let lo = 0,
		hi = distances.length - 1;
	while (hi - lo > 1) {
		const mid = Math.floor((lo + hi) / 2);
		if (distances[mid] <= s) lo = mid;
		else hi = mid;
	}
	return lo;
}

/** Locates a station on a sampled centreline by its spatial distance in metres. */
export function pathPoint(
	path: readonly Vec3[],
	distances: readonly number[],
	station: number
): Vec3 {
	const i = segment(distances, station);
	const span = distances[i + 1] - distances[i];
	return interpolatePoint(path[i], path[i + 1], span ? (station - distances[i]) / span : 0);
}

/** Midpoints of equal arc-length bays along an open or closed path, in metres. */
export function pathSupports(path: readonly Vec3[], maxSpacing: number) {
	const distances = chainage(path),
		length = distances[distances.length - 1];
	const count = Math.ceil(length / maxSpacing);
	return Array.from({ length: count }, (_, i) =>
		pathPoint(path, distances, ((i + 0.5) * length) / count)
	);
}
export { sweepProfile, profileSolid } from './sweep';

/** A circular sweep through explicit stations; straight samples are not interpolated again. */
export function pathTube(points: Vec3[], radius: number) {
	return { kind: 'pipe' as const, points, radius, sampled: true as const };
}
export { contours } from './contours';
