import { createStoryValley } from './index';

/** Reads the same seeded settlement from its first buildings to the 2030 handover. */
export function example() {
	return createStoryValley().snapshots.map(({ year, buildings, crossings }) => ({
		year,
		houses: buildings.length,
		storeys: buildings
			.flatMap(({ parts }) => parts)
			.filter(({ part }) => part.id.includes('/storey/')).length,
		crossings: crossings.length
	}));
}
