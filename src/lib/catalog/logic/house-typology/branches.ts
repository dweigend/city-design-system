import { STORY } from '../../data/grid';
import { objectSlot } from './objects';
import type { HouseUse } from '../../data/house-body';
import type { Level, Plan, Point } from './types';

/** Seats three separate cabins on short radial arms at successive half-storeys. */
export function branchLevel(plan: Plan, i: number, use: HouseUse): Level {
	const { site } = plan,
		[cx, cy] = site.center,
		n = site.programme.length;
	const arm = i - Math.max(0, n - 3),
		[u, v] = [
			[1, 0],
			[0, 1],
			[-1, 0]
		][arm];
	const branches = Math.min(n, 3);
	const spacing = 2 * Math.floor((n - 1) / 4) + 1;
	const z = plan.datum + (n - 1) * STORY - ((branches - 1 - arm) * spacing * STORY) / 2;
	const reach = Math.min(4.25, (u ? site.width : site.depth) / 2 - 1.6);
	const at = (r: number, s: number, height = z): Point => [
		cx + u * r - v * s,
		cy + v * r + u * s,
		height
	];
	const body = objectSlot(
		site.id + '/level/' + i + '/body/0',
		['kit-crown-lantern-2p5m', 'standard', use === 'living' ? 'capsule' : 'lookout'],
		use,
		plan.seed,
		0
	);
	body.scale = 1.15;
	body.size = body.nativeSize.map((d) => d * body.scale) as Point;
	body.position = at(reach, 0, z + 0.12);
	const inner = reach - 1.575,
		outer = reach + 1.575;
	const outline = [
		[-0.72, -0.72],
		[inner, -0.72],
		[inner, -1.575],
		[outer, -1.575],
		[outer, 1.575],
		[inner, 1.575],
		[inner, 0.72],
		[-0.72, 0.72]
	].map(([r, s]) => at(r, s));
	const dims = [0, 1].map(
		(k) => Math.max(...outline.map((p) => p[k])) - Math.min(...outline.map((p) => p[k]))
	);
	return {
		position: at((outer - 0.72) / 2, 0),
		width: dims[0],
		depth: dims[1],
		round: false,
		field: true,
		outline,
		deckArea: 3.15 ** 2 + 1.44 * (inner + 0.72),
		programme: site.programme[i],
		use,
		kind: use === 'living' ? 'capsule' : 'lookout',
		bodies: [body],
		landing: [cx, cy - 0.55, z]
	};
}
