import assert from 'node:assert/strict';
import { expect, test } from 'bun:test';
import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';
import { planTownForms } from '../town-forms';
import { planCity, styleWeightsAt } from '.';
import { routeLine } from '../transit-line';

test('ten valley seeds have distinct characters on dry sites and routable links to every centre', () => {
	for (let seed = 0; seed < 10; seed++) {
		const grid = deriveGrid(createTerrain({ seed }));
		const town = planTownForms(grid, seed);
		assert(town);
		const city = planCity(grid, town.railCellIds, new Set());
		expect(city.centres.length).toBeGreaterThanOrEqual(2);
		expect(city.centres.length).toBeLessThanOrEqual(4);
		expect(new Set(city.centres.map((c) => c.character)).size).toBe(city.centres.length);
		const reached = new Set([town.railCellIds[0]]);
		for (const cellIds of city.corridors) {
			expect(reached.has(cellIds[0])).toBe(true);
			expect(routeLine(grid, { id: 'rail', kind: 'viaduct', cellIds })).toBeDefined();
			reached.add(cellIds[1]);
		}
		for (const c of city.centres) {
			expect(grid.cellsById.get(c.cellId)?.buildable).toBe(true);
			expect(reached.has(c.cellId)).toBe(true);
			expect(c.lots.length).toBeGreaterThan(8);
		}
		if (seed === 7) expect(planCity(grid, town.railCellIds, new Set())).toEqual(city);
	}
}, 180000);

test('normalised house style weights vary continuously across district boundaries', () => {
	const grid = deriveGrid(createTerrain({ seed: 7 }));
	const town = planTownForms(grid, 7);
	assert(town);
	const city = planCity(grid, town.railCellIds, new Set());
	const mixes = new Set<number>();
	let jump = 0;
	for (const cell of grid.cells) {
		const mix = styleWeightsAt(city, cell.id);
		const sum = Object.values(mix).reduce((a, b) => a + b);
		assert(Math.abs(sum - 1) < 1e-9);
		mixes.add(Math.round(mix.composed * 100));
		for (const id of cell.neighbors) {
			const other = id && grid.cellsById.get(id);
			if (!other) continue;
			const next = styleWeightsAt(city, other);
			jump = Math.max(
				jump,
				...Object.keys(mix).map((key) =>
					Math.abs(next[key as keyof typeof mix] - mix[key as keyof typeof mix])
				)
			);
		}
	}
	expect(jump).toBeLessThan(0.13);
	expect(mixes.size).toBeGreaterThan(10);
});
