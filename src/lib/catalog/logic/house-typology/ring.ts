import { objectSlot } from './objects';
import type { HouseUse } from '../../data/house-body';
import type { Level, Plan, Point } from './types';

function circle(x: number, y: number, z: number, r: number): Point[] {
	return Array.from({ length: 64 }, (_, i) => [
		x + r * Math.cos((i * Math.PI) / 32),
		y + r * Math.sin((i * Math.PI) / 32),
		z
	]);
}

/** Seats a ring of rigid glazed drums around a clear spiral well. The rear bay serves the landing. */
export function ringLevel(plan: Plan, i: number, z: number, use: HouseUse): Level {
	const { site, sign } = plan,
		[x, y] = site.center;
	const span = Math.min(site.width, site.depth, 20);
	const module = span >= 18 ? 5 : span >= 14 ? 3.75 : 2.5;
	const radius = span * (0.49 + (0.009 * i) / Math.max(1, site.programme.length - 1));
	const scale = span < 12 ? 0.85 : 1.1;
	const diameter = module * scale;
	const axis = radius - diameter / 2 - 0.095;
	const count = Math.floor(Math.PI / Math.asin((diameter + 0.04) / (2 * axis)));
	const hole = Math.max(0.4, axis - diameter / 2 - 0.095);
	const spec = 'kit-crown-lantern-' + String(module).replace('.', 'p') + 'm';
	const body = objectSlot(
		site.id + '/level/' + i + '/body/0',
		'cantilever',
		[
			spec,
			(i + (plan.seed & 1)) % 4 < 2 ? 'tall' : 'standard',
			use === 'living' ? 'capsule' : 'lookout'
		],
		use,
		plan.seed,
		0
	);
	body.scale = scale;
	body.size = body.nativeSize.map((v) => v * scale) as Point;
	const bodies = Array.from({ length: count - 1 }, (_, j) => {
		const angle = (2 * Math.PI * (j + 1)) / count;
		return {
			...body,
			id: site.id + '/level/' + i + '/body/' + j,
			position: [x + axis * Math.sin(angle), y + sign * axis * Math.cos(angle), z + 0.3] as Point
		};
	});
	return {
		position: [x, y, z],
		width: 2 * radius,
		depth: 2 * radius,
		round: true,
		deckArea: Math.PI * (radius * radius - hole * hole),
		outline: circle(x, y, z, radius),
		well: circle(x, y, z, hole),
		programme: site.programme[i],
		use,
		kind: 'lookout',
		bodies,
		landing: [x, y + sign * (hole + 0.45), z]
	};
}
