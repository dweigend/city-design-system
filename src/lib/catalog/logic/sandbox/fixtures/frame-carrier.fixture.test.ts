import { createTerrain } from '../../terrain';
import { deriveGrid } from '../../terrain-grid';
import { EMPTY_STATE, type World } from '../index';
/** One living storey on buildable parcels in two of three diagonal bands of the 100 m carrier. */
export function frameCarrier(seed: number): World {
	const grid = deriveGrid({ ...createTerrain({ seed }), along: 100, across: 100 });
	const stacks = new Map(
		grid.cells
			.filter((c) => c.buildable && (c.column + c.row) % 3 !== 0)
			.map((c) => [c.id, ['living'] as const])
	);
	return { seed, grid, state: { ...EMPTY_STATE, stacks }, lines: [] };
}
