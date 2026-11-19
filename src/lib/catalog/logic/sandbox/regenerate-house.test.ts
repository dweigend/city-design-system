import { expect, test } from 'bun:test';
import {
	applyEdit,
	changes,
	composedHouseIds,
	createWorld,
	regenerateHouse,
	withState
} from './index';
import { buildingPlots } from './building-plots';
import { circulation, planHouse, sectionParts, housePartPlan } from '../composed-house';
import { squareGrid } from '../quad-grid';
import { bounds } from '../ansicht/geometrie';

test('selected regeneration preserves paint, unrelated house geometry and undo state', () => {
	let world = createWorld(7, { cells: 0 });
	for (const id of ['30/30', '32/30'])
		world = applyEdit(world, { kind: 'raise', cellId: id, use: 'living' });
	const ids = composedHouseIds(world);
	expect(ids).toHaveLength(2);
	const next = regenerateHouse(world, ids[0]);
	expect(next.state.stacks).toBe(world.state.stacks);
	expect(next.state.storyParts.get(ids[1])).toBe(world.state.storyParts.get(ids[1]));
	expect(next.state.storyParts.get(ids[0])?.[0].houseSeed).toBeDefined();
	const changed = changes(world, next).houseGroups;
	expect(changed.has('composed/' + ids[0])).toBe(true);
	expect(changed.has('composed/' + ids[1])).toBe(false);
	expect(withState(next, world.state).state).toBe(world.state);
	expect(regenerateHouse(world, 'absent')).toBe(world);
});

test('seed-7 terrain parcels and narrow 1.8–5 metre bays carry connected access', () => {
	const grid = buildingPlots(createWorld(7, { cells: 0 }).grid);
	const lots = [
		...['30/30', '31/30'].flatMap((id) => grid.cellsById.get(id) ?? []),
		...[1.8, 2.5, 3, 4, 5].map((w) => squareGrid(1, 1, w).cells[0])
	];
	for (const c of lots)
		for (const height of [1, 4, 12, 32])
			for (const seed of [2, 7, 19]) {
				const s = planHouse({
					cells: [c],
					seed,
					stacks: new Map([[c.id, Array<'living'>(height).fill('living')]])
				});
				const route = circulation(s);
				expect(route.stops).toHaveLength(s.decks.length + 2);
				const volumes = sectionParts(s).map((p) => {
					expect(
						housePartPlan(p).every(([x, y]) =>
							c.corners.every(([u, v], i) => {
								const q = c.corners[(i + 1) % 4];
								return (q[0] - u) * (y - v) - (q[1] - v) * (x - u) >= -1e-6;
							})
						),
						p.id + ' on ' + c.id
					).toBe(true);
					const b = bounds(p);
					return {
						v: b.max.reduce((v, x, i) => v * (x - b.min[i]), 1),
						access: p.id.includes('/stair/')
					};
				});
				const sum = (access: boolean) =>
					volumes.reduce((v, p) => v + (!access || p.access ? p.v : 0), 0);
				expect(sum(true) / sum(false)).toBeLessThanOrEqual(0.1);
			}
});
