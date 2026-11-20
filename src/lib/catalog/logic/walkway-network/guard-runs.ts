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
		} else if (
			p.kind === 'cylinder' &&
			p.id.startsWith('town-walk/platform/') &&
			!p.id.includes('/meeting/') &&
			!p.id.endsWith('/pier')
		) {
			const [cx, cy, z] = p.position;
			supports.push({ z: z + p.height, covers: (x, y) => Math.hypot(x - cx, y - cy) <= p.radius });
		}
	}
	return supports;
}
/** Samples the highest finished ground, court paving or meeting platform beneath the walking elevation. */
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

function intervals(a: Vec3, b: Vec3, exposed: (p: Vec3) => boolean) {
	const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
	const at = (j: number) => (j === 0 ? a : j === count ? b : interpolatePoint(a, b, j / count));
	const runs: Vec3[][] = [];
	let start = 0;
	for (let i = 0; i <= count; i++) {
		if (i < count && exposed(at(i + 0.5))) continue;
		if (start < i) runs.push([at(start), at(i)]);
		start = i + 1;
	}
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
