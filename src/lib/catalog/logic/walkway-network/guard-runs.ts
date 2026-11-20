import { interpolatePoint, type Vec3, type Primitive } from '../parametrik/types';
import { walkingProfile } from './walking-profile';

type Ground = (x: number, y: number, z: number) => number;
/** Includes adjoining circular meeting platforms when measuring the fall beyond a walking edge. */
export function landingGround(
	parts: Primitive[],
	ground: (x: number, y: number) => number
): Ground {
	const landings = parts.flatMap((p) =>
		p.kind === 'cylinder' && !p.id.includes('/meeting/') && !p.id.endsWith('/pier')
			? [{ x: p.position[0], y: p.position[1], z: p.position[2] + p.height, r: p.radius }]
			: []
	);
	return (x, y, z) => {
		let surface = ground(x, y);
		for (const p of landings)
			if (p.z <= z + 1e-7 && p.z > surface && Math.hypot(p.x - x, p.y - y) < p.r - 0.05)
				surface = p.z;
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
export function guardRuns(edge: Vec3[], ground: Ground, seat: (p: Vec3) => number) {
	const exposed = (p: Vec3) => {
		const z = seat(p),
			surface = ground(p[0], p[1], z);
		return !Number.isFinite(surface) || z - surface >= walkingProfile.guardDrop;
	};
	return edge.slice(1).flatMap((b, i) => intervals(edge[i], b, exposed));
}
