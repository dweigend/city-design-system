import { checkParcel } from '../composed-house/parcel-assertions.test-support';
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
import { paintedSections, circulation, planHouse, sectionParts } from '../composed-house';
import { squareGrid } from '../quad-grid';
import { accessShare } from '../composed-house/access-budget';

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

test('terrain parcels and 1.8–5 metre bays keep supports inside and limit body cantilevers to 0.6 m', () => {
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
				if (s.compact)
					for (const leg of route.legs)
						expect(Math.abs(leg.from[2] - leg.to[2])).toBeLessThanOrEqual(4 + 1e-8);
				expect(route.stops).toHaveLength(s.decks.length + 2);
				const plinths = s.composition.parts.flatMap((p) =>
					p.slot === 'base' && p.kind === 'prism' ? [{ bottom: p.z, top: p.z + p.height }] : []
				);
				expect(plinths.length).toBeGreaterThan(0);
				for (const { bottom, top } of plinths) {
					// The carrier pad gives the walking datum at the slab's top.
					expect(top).toBeCloseTo(c.pad);
					expect(bottom).toBeCloseTo(s.composition.ground);
				}
				const parts = sectionParts(s);
				checkParcel(s, parts);
				expect(accessShare(parts)).toBeLessThanOrEqual(0.1);
			}
});

test('cantilevered bodies on neighbouring narrow plots clear each other within 2 cm', () => {
	for (const [columns, rows] of [
		[2, 1],
		[1, 2]
	])
		for (const seed of [0, 1, 7, 23]) {
			const grid = squareGrid(columns, rows, 1.8);
			const [a, b] = paintedSections(
				grid,
				new Map(grid.cells.map((c) => [c.id, Array<'living'>(3).fill('living')])),
				seed,
				{ joined: () => false }
			);
			const bodies = (h: typeof a) => h.composition.levels.flatMap((l) => l.bodies);
			for (const left of bodies(a))
				for (const right of bodies(b)) {
					const overlap = left.position.map((v, i) =>
						i === 2
							? Math.min(v + left.size[2], right.position[2] + right.size[2]) -
								Math.max(v, right.position[2])
							: (left.size[i] + right.size[i]) / 2 - Math.abs(v - right.position[i])
					);
					expect(Math.min(...overlap)).toBeLessThanOrEqual(0.020001);
				}
		}
});
