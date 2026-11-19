import assert from 'node:assert/strict';
import type { Vec3 } from '../../../logic/parametrik/types';
import type { World } from '../../../logic/sandbox';
import { quadGrid } from '../../../logic/quad-grid';
import legacy from './seed-7-pick-lots.json';
/** Restores the two pre-I review rays’ building masses and their adjacent terrain cells. */
export function reviewWorld(seed: World) {
	const sample = [...seed.state.storyParts.values()].flat()[0];
	const stacks = new Map<string, 'living'[]>(),
		storyParts = new Map<string, (typeof sample)[]>();
	const cells = seed.grid.cells.slice();
	for (const lot of legacy.cells) {
		const id = lot.id,
			count = lot.stories;
		const cell = seed.grid.cellsById.get(id);
		assert.ok(cell);
		const [a, b, c, d] = lot.vertices.map((i) => legacy.vertices[i] as Vec3);
		const corners = [a, b, c, d] as const;
		const mean = (axis: number) => corners.reduce((sum, v) => sum + v[axis], 0) / 4;
		cells[cell.index] = {
			...cell,
			corners,
			pad: lot.pad,
			center: [mean(0), mean(1), mean(2)],
			raised: false,
			lotCorners: undefined
		};
		if (!count) continue;
		stacks.set(id, Array(count).fill('living'));
		storyParts.set(
			id,
			Array.from({ length: count }, (_, level) => ({
				...sample,
				id: id + '@' + level,
				anchor: { cellId: id, level }
			}))
		);
	}
	return {
		...seed,
		grid: { ...seed.grid, ...quadGrid(cells) },
		state: { ...seed.state, stacks, storyParts }
	};
}
