import { insideCourt } from './court-life';
import { interpolatePoint, type Vec3, type Primitive } from '../parametrik/types';
import { walkingProfile } from './walking-profile';

type Ground = (x: number, y: number, z: number) => number;
type Support = { z: number; covers: (x: number, y: number) => boolean };
function walkingSupports(parts: Primitive[]) {
	const supports: Support[] = [];
	for (const p of parts) {
		if (p.kind === 'prism' && p.id.startsWith('court/')) {
			supports.push({ z: p.z + p.height, covers: (x, y) => insideCourt([x, y], p.polygon) });
		}
	}
	return supports;
}
/** Samples the highest finished ground or court paving beneath the walking elevation. */
export function landingGround(
	parts: Primitive[],
	ground: (x: number, y: number) => number
): Ground {
	const supports = walkingSupports(parts);
	return (x, y, z) => {
		let surface = ground(x, y);
		for (const p of supports) {
			if (p.z <= z + 1e-7 && (!Number.isFinite(surface) || p.z > surface) && p.covers(x, y))
				surface = p.z;
		}
		return surface;
	};
}

function transition(start: number, end: number, changed: (u: number) => boolean) {
	let lo = start,
		hi = end;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (changed(mid)) hi = mid;
		else lo = mid;
	}
	if (end - hi < 1e-8) return end;
	if (lo - start < 1e-8) return start;
	return (lo + hi) / 2;
}
function intervals(a: Vec3, b: Vec3, exposed: (p: Vec3) => boolean) {
	const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
	const at = (t: number) => (t === 0 ? a : t === 1 ? b : interpolatePoint(a, b, t));
	let from = exposed(a) ? 0 : undefined;
	const runs: Vec3[][] = [];
	for (let i = 1; i <= count; i++) {
		const t = i / count,
			open = exposed(at(t));
		if (open === (from !== undefined)) continue;
		const boundary = transition((i - 1) / count, t, (u) => exposed(at(u)) === open);
		if (from !== undefined && boundary > from) runs.push([at(from), at(boundary)]);
		from = open ? boundary : undefined;
	}
	if (from !== undefined && from < 1) runs.push([at(from), b]);
	return runs;
}
/** Clips each edge segment to the stretches where its walking face drops away.
 * Half-metre samples locate transitions without adding vertices to a straight guard. */
export function guardRuns(
	edge: Vec3[],
	ground: Ground,
	seat: (p: Vec3) => number,
	outward: 1 | -1
) {
	return edge.slice(1).flatMap((b, i) => {
		const a = edge[i],
			dx = b[0] - a[0],
			dy = b[1] - a[1],
			length = Math.hypot(dx, dy);
		if (!length) return [];
		const offset = (outward * 0.4) / length;
		return intervals(a, b, (p) => {
			const z = seat(p),
				surface = ground(p[0] + dy * offset, p[1] - dx * offset, z);
			return !Number.isFinite(surface) || z - surface >= walkingProfile.guardDrop;
		});
	});
}
