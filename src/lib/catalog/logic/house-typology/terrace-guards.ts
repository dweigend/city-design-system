import { objectSlot } from './objects';
import type { Level, Plan } from './types';

/** Seats a solid return on the exposed flank of each inhabited terrace. */
export function terraceGuards(plan: Plan, levels: Level[]) {
	return levels.flatMap((level) => {
		const b = level.bodies[0];
		if (!b.band) return [];
		const side = Math.sign(level.position[0] - b.position[0]);
		const rail = objectSlot(
			b.id + '/terrace',
			['kit-parapet-solid-2p5m', 'narrow', 'workshop'],
			b.use,
			plan.seed,
			Math.PI / 2
		);
		rail.position = [
			level.position[0] + side * (level.width / 2 - 0.2),
			b.position[1],
			level.position[2]
		];
		return [rail];
	});
}
