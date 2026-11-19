import type { Vec3 } from '../parametrik/types';

// Match the centripetal Catmull–Rom curve in the Three.js tube renderer.
const SAMPLES = 96;

function extrapolate(a: Vec3, b: Vec3): Vec3 {
	return a.map((value, i) => 2 * value - b[i]) as Vec3;
}

function spacing(a: Vec3, b: Vec3): number {
	return Math.sqrt(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
}

function span(points: Vec3[], index: number) {
	const b = points[index];
	const c = points[index + 1];
	const a = points[index - 1] ?? extrapolate(b, c);
	const d = points[index + 2] ?? extrapolate(c, b);
	const middle = spacing(b, c);
	const step = middle < 1e-4 ? 1 : middle;
	const before = spacing(a, b);
	const after = spacing(c, d);
	const left = before < 1e-4 ? step : before;
	const right = after < 1e-4 ? step : after;
	return (t: number): Vec3 =>
		b.map((start, axis) => {
			const end = c[axis];
			const delta = end - start;
			const u = ((start - a[axis]) / left - (end - a[axis]) / (left + step)) * step + delta;
			const v = ((d[axis] - end) / right - (d[axis] - start) / (step + right)) * step + delta;
			return start + t * (u + t * (3 * delta - 2 * u - v + t * (-2 * delta + u + v)));
		}) as Vec3;
}

/** Samples the world-space pipe centerline in meters, keeping straight pipes exact. */
export function pipeCenterline(points: Vec3[]): Vec3[] {
	if (points.length <= 2) return points;
	const count = points.length - 1;
	const spans = points.slice(1).map((_, i) => span(points, i));
	return Array.from({ length: SAMPLES }, (_, i) => {
		const at = (i * count) / SAMPLES;
		const index = Math.floor(at);
		return spans[index](at - index);
	}).concat(points.slice(-1));
}
