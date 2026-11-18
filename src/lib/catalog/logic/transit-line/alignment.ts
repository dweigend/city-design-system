import type { Vec3 } from '../parametrik/types';
const SAMPLE = 2;
const MIN_SEGMENT = 1e-8; // Meters. Coincident samples can mask a reversal.
const SMOOTHING_PASSES = 8;
export function chainage(path: readonly Vec3[]) {
	const distances = [0];
	for (let i = 1; i < path.length; i++) {
		const a = path[i - 1],
			b = path[i];
		distances.push(distances[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
	}
	return distances;
}
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
function interpolate(a: Vec3, b: Vec3, t: number): Vec3 {
	if (t >= 1) return [...b];
	return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}
function resample(path: Vec3[]) {
	const distances = chainage(path),
		length = distances[distances.length - 1],
		count = Math.max(1, Math.ceil(length / SAMPLE));
	return Array.from({ length: count + 1 }, (_, n) => {
		if (n === count) return path[path.length - 1];
		const s = (n * length) / count,
			i = segment(distances, s);
		return interpolate(
			path[i],
			path[i + 1],
			(s - distances[i]) / (distances[i + 1] - distances[i] || 1)
		);
	});
}
function bendsTooTightly(path: Vec3[], radius: number) {
	return path.some((b, i) => {
		if (!i || i === path.length - 1) return false;
		const a = path[i - 1],
			c = path[i + 1],
			x = b[0] - a[0],
			y = b[1] - a[1],
			u = c[0] - b[0],
			v = c[1] - b[1];
		const chord = Math.hypot(x + u, y + v);
		// Also detect a collinear reversal, where circumcircle curvature is undefined.
		return (
			Math.min(Math.hypot(x, y), Math.hypot(u, v)) < MIN_SEGMENT ||
			x * u + y * v < 0 ||
			2 * radius * Math.abs(x * v - y * u) > Math.hypot(x, y) * Math.hypot(u, v) * chord
		);
	});
}
export function alignment(centers: Vec3[], radius: number) {
	let path = resample(centers.map(([x, y]) => [x, y, 0]));
	while (path.length > 2 && bendsTooTightly(path, radius)) {
		// Local diffusion leaves straight spans and both boundary conditions intact.
		for (let pass = 0; pass < SMOOTHING_PASSES; pass++)
			path = path.map((p, i) => {
				if (!i || i === path.length - 1) return p;
				return interpolate(p, interpolate(path[i - 1], path[i + 1], 0.5), 0.5);
			});
		path = resample(path);
	}
	return path;
}
export function poseAt(path: readonly Vec3[], distances: number[], s: number) {
	const i = segment(distances, s),
		a = path[i],
		b = path[i + 1],
		t = (s - distances[i]) / (distances[i + 1] - distances[i]);
	const tangent = (j: number) => {
		const p = path[Math.max(0, j - 1)],
			q = path[Math.min(path.length - 1, j + 1)];
		const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
		return [(q[0] - p[0]) / d, (q[1] - p[1]) / d, (q[2] - p[2]) / d] satisfies Vec3;
	};
	const [x, y, z] = interpolate(tangent(i), tangent(i + 1), t);
	return {
		position: interpolate(a, b, t),
		headingRad: Math.atan2(y, x),
		pitchRad: Math.atan2(z, Math.hypot(x, y))
	};
}
