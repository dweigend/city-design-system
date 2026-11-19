import type { Vec3 } from '../parametrik/types';

// Match the centripetal Catmull–Rom curve in the Three.js tube renderer.
const SAMPLES = 96;
const ARC_DIVISIONS = 200;

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

function arcLengths(pointAt: (t: number) => Vec3) {
	const lengths = [0];
	let previous = pointAt(0);
	for (let i = 1; i <= ARC_DIVISIONS; i++) {
		const point = pointAt(i / ARC_DIVISIONS);
		const [x, y, z] = point;
		lengths.push(lengths[i - 1] + Math.hypot(x - previous[0], y - previous[1], z - previous[2]));
		previous = point;
	}
	return lengths;
}

/** Samples the world-space pipe centerline at the rendered tube's arc-length intervals. */
export function pipeCenterline(points: Vec3[]): Vec3[] {
	if (points.length <= 2) return points;
	const count = points.length - 1;
	const spans = points.slice(1).map((_, i) => span(points, i));
	const pointAt = (t: number): Vec3 => {
		const at = t * count;
		const index = Math.floor(at);
		return spans[index]?.(at - index) ?? points[count];
	};
	const lengths = arcLengths(pointAt);
	const total = lengths[ARC_DIVISIONS];
	if (total === 0) return [points[0]];
	let index = 0;
	return Array.from({ length: SAMPLES }, (_, i) => {
		const distance = (i / SAMPLES) * total;
		while (lengths[index + 1] < distance) index++;
		const step = lengths[index + 1] - lengths[index];
		const fraction = step === 0 ? 0 : (distance - lengths[index]) / step;
		return pointAt((index + fraction) / ARC_DIVISIONS);
	}).concat(points.slice(-1));
}
