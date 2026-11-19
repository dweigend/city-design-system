import type { SpongeWork } from './state';
import type { World } from './world-contract';

function addedBays(before: World, after: World) {
	let count = 0;
	for (const [id, bay] of after.state.frameBays ?? [])
		if (bay.built && !before.state.frameBays?.get(id)?.built) count++;
	return count;
}

function fittedTanks(before: World, after: World) {
	let count = 0;
	for (const [id, part] of after.state.parts)
		if (part.kind === 'module' && part.recipe === 'tank' && !before.state.parts.has(id)) count++;
	return count;
}

/** Counts newly occupied house lots, built bays and water works between the start and finish of one advance. */
export function advanceAdditions(
	before: World,
	after: World
): Record<SpongeWork['kind'] | 'bay' | 'house', number> {
	const added = {
		house: after.state.stacks.size - before.state.stacks.size,
		bay: addedBays(before, after),
		tank: fittedTanks(before, after),
		'retention-basin': 0,
		'green-roof': 0,
		'water-square': 0
	};
	const prior = new Set(before.state.spongeWorks);
	for (const work of after.state.spongeWorks ?? []) if (!prior.has(work)) added[work.kind]++;
	return added;
}
