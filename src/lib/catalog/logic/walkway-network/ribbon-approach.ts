import { crossfall } from './ribbon-soil';
import type { Vec3 } from '../parametrik/types';
import { ribbonCurve, type Section } from './ribbon-curve';
import { easedRun } from './ribbon-rise';
import { walkingProfile } from './walking-profile';
type Ground = (x: number, y: number) => number;
type Clear = (a: Vec3, b: Vec3) => boolean;
function clearance(sections: Section[], base: number, top: number, ground: Ground) {
	let d = 0,
		deficit = 0;
	for (const [i, s] of sections.entries()) {
		if (i) {
			const prev = sections[i - 1].centre;
			d += Math.hypot(s.centre[0] - prev[0], s.centre[1] - prev[1]);
		}
		const z = base + walkingProfile.gradeLimit * easedRun(d, Math.max(2, d + 1));
		const soil = crossfall(s.left, s.right, ground);
		if (!Number.isFinite(soil)) return Infinity;
		deficit = Math.max(deficit, soil + 0.05 - z);
	}
	return Math.max(deficit, top - base - walkingProfile.gradeLimit * easedRun(d, d)) * 10000 + d;
}
function controls(
	a: Vec3,
	b: Vec3,
	last: Vec3,
	angle: number,
	sign: number,
	length: number,
	width: number
) {
	const u = Math.cos(angle),
		v = Math.sin(angle);
	const at = (p: Vec3, d: number, w: number): Vec3 => [
		p[0] + d * u - sign * w * v,
		p[1] + d * v + sign * w * u,
		p[2]
	];
	const dx = b[0] - last[0],
		dy = b[1] - last[1],
		d = Math.hypot(dx, dy);
	const entry: Vec3 = [b[0] - (3 * dx) / d, b[1] - (3 * dy) / d, b[2]];
	return [
		a,
		at(a, length * 0.5, 0),
		at(a, length, 0),
		at(a, length, width),
		at(a, length * 0.55, width),
		entry,
		b
	];
}
type Layout = [number, number, number, number];
function* layouts(): Generator<Layout> {
	for (const length of [8, 16, 26, 40])
		for (const width of [6, 12])
			for (const sign of [-1, 1])
				for (let i = 0; i < 16; i++) yield [(Math.PI * i) / 8, sign, length, width];
}
function* refine([angle, sign, length, width]: Layout): Generator<Layout> {
	for (const turn of [-1, 0, 1])
		for (const run of [-2, 0, 2])
			for (const spread of [-1, 0, 1])
				yield [angle + (turn * Math.PI) / 32, sign, length + run, width + spread];
}
function side(a: Vec3, b: Vec3, p: Vec3) {
	return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}
function crossesItself(sections: Section[]) {
	for (let i = 1; i < sections.length; i++) {
		const a = sections[i - 1].centre,
			b = sections[i].centre;
		for (let j = i + 2; j < sections.length; j++) {
			const c = sections[j - 1].centre,
				d = sections[j].centre;
			if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;
		}
	}
	return false;
}
/** Fits a longer, smooth approach to a low terminal when the direct ramp cannot clear the bank. */
export function contourApproach(
	original: Section[],
	base: number,
	top: number,
	ground: Ground,
	clear: Clear
) {
	const a = original[0].centre,
		b = original[original.length - 1].centre,
		last = original[original.length - 2].centre;
	let best = original,
		score = clearance(original, base, top, ground);
	let selected: Layout | undefined;
	const consider = (layout: Layout) => {
		const points = controls(a, b, last, ...layout);
		if (!points.slice(1).every((p, j) => clear(points[j], p))) return;
		const candidate = ribbonCurve(points);
		const cost = clearance(candidate, base, top, ground);
		if (cost >= score || !candidate.slice(1).every((s, j) => clear(candidate[j].centre, s.centre)))
			return;
		// A tight turn with an inverted inner edge cannot carry a constant-width deck.
		const folds = candidate.slice(1).some((s, j) => {
			const p = candidate[j],
				dx = s.centre[0] - p.centre[0],
				dy = s.centre[1] - p.centre[1];
			return [s.left.map((v, k) => v - p.left[k]), s.right.map((v, k) => v - p.right[k])].some(
				(e) => e[0] * dx + e[1] * dy <= 0
			);
		});
		if (!folds && !crossesItself(candidate)) {
			selected = layout;
			score = cost;
			best = candidate;
		}
	};
	for (const layout of layouts()) consider(layout);
	if (selected) for (const layout of refine(selected)) consider(layout);
	return best;
}
