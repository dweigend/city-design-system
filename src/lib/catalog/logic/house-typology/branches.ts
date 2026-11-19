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
	const spacing = Math.max(2, 2 * Math.floor((n - 1) / 4) + 1);
	const z = plan.datum + (n - 1) * STORY - ((branches - 1 - arm) * spacing * STORY) / 2;
	const radial = (u ? site.width : site.depth) / 2;
	const at = (r: number, s: number, height = z): Point => [
		cx + u * r - v * s,
		cy + v * r + u * s,
		height
	];
	const free = u ? site.depth : site.width;
	const length = free >= 7.8 ? 7.5 : 5;
	const scale = Math.min(1.15, (free - 0.3) / length, (radial - 0.9) / 2.5);
	const half = 1.25 * scale + 0.15;
	const reach = Math.min(4.25, radial - half - 0.01);
	const tangent = (length * scale + 0.3) / 2;
	const body = objectSlot(
		site.id + '/level/' + i + '/body/0',
		['kit-capsule-ribbon-' + String(length).replace('.', 'p') + 'm', 'round-shoulder', 'capsule'],
		use,
		plan.seed,
		u ? Math.PI / 2 : 0
	);
	body.scale = scale;
	body.size = body.nativeSize.map((d) => d * scale) as Point;
	body.position = at(reach, 0, z + 0.3);
	const inner = reach - half,
		outer = reach + half;
	const outline = [
		[-0.72, -0.72],
		[inner, -0.72],
		[inner, -tangent],
		[outer, -tangent],
		[outer, tangent],
		[inner, tangent],
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
		deckArea: 4 * half * tangent + 1.44 * (inner + 0.72),
		programme: site.programme[i],
		use,
		kind: use === 'living' ? 'capsule' : 'lookout',
		bodies: [body],
		landing: [cx, cy - 0.55, z]
	};
}
