import { STORY } from '../../data/grid';
import { objectSlot } from './objects';
import type { Level, Plan, Point } from './types';
import type { HouseUse } from '../../data/house-body';

/** Seats one glazed circular cabin on the carrier, reserving a rear strip for its mast. */
export function podLevel(plan: Plan, i: number, use: HouseUse): Level {
	const { site, sign, rear } = plan;
	const z = plan.datum + i * STORY;
	const span = [10, 7.5, 5].find(
		(w) => site.depth >= 4.5 && w + (site.depth < 6 ? 6.5 : 0.6) <= site.width
	);
	const drum =
		Math.min(site.width, site.depth) >= 3.75 && Math.max(site.width, site.depth) >= 7 ? 3.75 : 2.5;
	const stock: Parameters<typeof objectSlot>[1] = span
		? ['kit-capsule-ribbon-' + String(span).replace('.', 'p') + 'm', 'round-shoulder', 'capsule']
		: [
				'kit-crown-lantern-' + String(drum).replace('.', 'p') + 'm',
				Math.floor(i / 4) % 2 ? 'standard' : 'tall',
				use === 'living' ? 'capsule' : 'workshop'
			];
	const b = objectSlot(site.id + '/level/' + i + '/body/0', stock, use, plan.seed, 0);
	const scale = Math.max(
		0.85,
		Math.min(span ? 1 : 1.065, site.width / b.nativeSize[0], (site.depth - (site.width>=7 && site.depth<4.5?0.3:0.5)) / b.nativeSize[1])
	);
	b.scale = scale;
	b.size = b.nativeSize.map((v) => v * scale) as Point;
	const [w, d] = b.size;
	const width = Math.min(site.width, w + 0.6);
	const depth = Math.min(site.depth, d + 1.1);
	const cx = site.center[0];
	const y = rear - (sign * depth) / 2;
	const band = Math.min(0.9, Math.max(0.25, depth - d));
	const overhang = Math.max(0, (w - site.width) / 2);
	b.position = [cx + overhang * plan.away[0], rear - sign * (band + d / 2), z + 0.3];
	b.facing = [0, sign];
	const outline: Point[] = [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([u, v]) => [cx + (u * width) / 2, y + (v * depth) / 2, z]);
	return {
		position: [cx, y, z],
		width,
		depth,
		round: false,
		deckArea: width * depth,
		outline,
		bodies: [b],
		kind: use === 'living' ? 'capsule' : 'workshop',
		use,
		programme: site.programme[i],
		landing: [
			cx + (site.width >= 7 && site.depth < 4.5 ? width / 2 - 0.45 : 0),
			rear - sign * Math.max(0.5, band / 2),
			z
		]
	};
}
