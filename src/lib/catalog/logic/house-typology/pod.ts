import { STORY } from '../../data/grid';
import { objectSlot } from './objects';
import type { Level, Plan, Point } from './types';
import type { HouseUse } from '../../data/house-body';

/** Seats one glazed circular cabin on the carrier, reserving a rear strip for its mast. */
export function podLevel(plan: Plan, i: number, use: HouseUse): Level {
	const { site, sign, rear } = plan;
	const z = plan.datum + i * STORY;
	const b = objectSlot(
		site.id + '/level/' + i + '/body/0',
		[
			'kit-crown-lantern-2p5m',
			Math.floor(i / 4) % 2 ? 'standard' : 'low',
			use === 'living' ? 'capsule' : 'workshop'
		],
		use,
		plan.seed,
		0
	);
	const scale = Math.max(0.85, Math.min(1, site.width / 2.5, (site.depth - 0.5) / 2.5));
	b.scale = scale;
	b.size = b.nativeSize.map((v) => v * scale) as Point;
	const [w, d] = b.size;
	const rise = site.ground - Math.min(...site.cells.flatMap((c) => c.corners.map((p) => p[2])));
	const count =
		site.compact && rise < STORY / 2
			? 1
			: Math.max(1, Math.min(4, Math.floor((site.width - 0.6) / (w + 0.05))));
	const width = Math.min(site.width, count * (w + 0.05) + 0.55);
	const depth = Math.min(site.depth - site.accessDepth, d + 1.1);
	const cx =
		site.center[0] +
		(plan.type === 'terrace-house' && !site.compact ? (site.width - width) / 2 : 0);
	const y = rear - (sign * depth) / 2;
	const band = Math.min(0.9, Math.max(0.25, depth - d));
	const overhang = Math.max(0, (w - site.width) / 2);
	b.position = [cx + overhang * plan.away[0], rear - sign * (band + d / 2), z + 0.12];
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
		bodies: Array.from({ length: count }, (_, j) => ({
			...b,
			id: site.id + '/level/' + i + '/body/' + j,
			position: [
				b.position[0] + (j - (count - 1) / 2) * (w + 0.05),
				b.position[1],
				b.position[2]
			] as Point
		})),
		kind: use === 'living' ? 'capsule' : 'workshop',
		use,
		programme: site.programme[i],
		landing: [cx, rear - sign * Math.max(0.38, band / 2), z]
	};
}
