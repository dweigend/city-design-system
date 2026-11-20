import type { Vec3 } from '../parametrik/types';
import { walkingProfile } from './walking-profile';

export type Section = { centre: Vec3; left: Vec3; right: Vec3 };
const half = walkingProfile.width / 2;
function section(p: Vec3[], t: number): Section {
	const u = 1 - t;
	const w = [u ** 3, 3 * t ** 3 - 6 * t * t + 4, -3 * t ** 3 + 3 * t * t + 3 * t + 1, t ** 3];
	const v = [-3 * u * u, 9 * t * t - 12 * t, -9 * t * t + 6 * t + 3, 3 * t * t];
	const sum = (weights: number[], k: number) => p.reduce((n, q, j) => n + q[k] * weights[j], 0) / 6;
	const centre: Vec3 = [sum(w, 0), sum(w, 1), sum(w, 2)];
	const dx = sum(v, 0),
		dy = sum(v, 1),
		d = Math.hypot(dx, dy);
	const offset = (h: number): Vec3 => [
		centre[0] - (dy * h) / d,
		centre[1] + (dx * h) / d,
		centre[2]
	];
	return { centre, left: offset(half), right: offset(-half) };
}
const reflect = (a: Vec3, b: Vec3): Vec3 => [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]];
/** Samples a uniform C2 cubic B-spline and offsets its analytic plan normal in metres. */
export function ribbonCurve(points: Vec3[]) {
	const last = points.length - 1,
		closed = points[0].join(',') === points[last].join(',');
	const controls = [
		closed ? points[last - 1] : reflect(points[0], points[1]),
		...points,
		closed ? points[1] : reflect(points[last], points[last - 1])
	];
	const samples: Section[] = [];
	for (let i = 0; i < last; i++) {
		const p = controls.slice(i, i + 4),
			end = section(p, 1);
		const start = section(p, 0);
		if (!i) samples.push(start);
		const append = (a: Section, b: Section, lo: number, hi: number, depth: number) => {
			const middle = (lo + hi) / 2,
				m = section(p, middle);
			const dot = (x: Section, y: Section) =>
				((x.left[0] - x.centre[0]) * (y.left[0] - y.centre[0]) +
					(x.left[1] - x.centre[1]) * (y.left[1] - y.centre[1])) /
				(half * half);
			if (
				depth < 12 &&
				(Math.min(dot(a, m), dot(m, b)) < Math.cos(Math.PI / 160) ||
					Math.hypot(b.centre[0] - a.centre[0], b.centre[1] - a.centre[1]) > 1)
			) {
				append(a, m, lo, middle, depth + 1);
				append(m, b, middle, hi, depth + 1);
			} else samples.push(b);
		};
		append(start, end, 0, 1, 0);
	}
	return samples;
}
