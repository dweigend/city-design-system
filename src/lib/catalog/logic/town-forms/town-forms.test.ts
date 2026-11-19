import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { planTownForms } from '.';
import { neighborsOf } from '../quad-grid';
import { createTerrain, terrainZone, bankDistance } from '../terrain';
import { deriveGrid, BLOCK } from '../terrain-grid';
import { routeLine } from '../transit-line';

const grid = deriveGrid(createTerrain({ seed: 7 }));
const reserved = new Set(['111/42', '73/24']);
const example = () => {
	const plan = planTownForms(grid, 7, reserved);
	assert(plan, 'Expected a riverside town and a linked satellite');
	return plan;
};
const cell = (id: string) => {
	const site = grid.cellsById.get(id);
	assert(site);
	return site;
};

test('seed 7 reproduces the same ordered construction plan', () => {
	const bytes = JSON.stringify(example());
	expect(JSON.stringify(example())).toBe(bytes);
	// SHA-256 of the ordered JSON captured before relaxing the layout constraints.
	expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(
		'6f1299597dfed55ff89ced70f6f4fd1ec7b77ea69a85c30cb937bb638f84603d'
	);
});

test('open land separates the connected satellite from the town and rail reaches both', () => {
	const { runs, satellite, railCellIds } = example();
	const east = Math.max(...runs.flatMap((run) => run.map(({ cellId }) => cell(cellId).column)));
	const west = Math.min(...satellite.map(({ cellId }) => cell(cellId).column));
	expect(west - east).toBeGreaterThanOrEqual(7);
	const [townStop, satelliteStop] = railCellIds.map(cell);
	expect(townStop.column).toBeLessThan(east);

	const remaining = new Set(satellite.map(({ cellId }) => cellId));
	const reached = [satelliteStop];
	for (const site of reached) {
		for (const next of neighborsOf(grid, site)) {
			if (remaining.delete(next.id)) reached.push(next);
		}
	}
	expect(reached.length).toBeGreaterThan(5);
	expect(remaining.size).toBe(0);

	const line = routeLine(grid, { id: 'example', kind: 'viaduct', cellIds: railCellIds });
	assert(line);
	expect(line.stops.length).toBeGreaterThanOrEqual(2);
	expect(line.path.every(([x, y]) => terrainZone(grid.terrain, x, y) !== 'water')).toBe(true);
});

test('short mixed-use runs step away from the bank and leave open breaks', () => {
	const { runs } = example();
	expect(runs.length).toBeGreaterThanOrEqual(3);
	const bounds = runs.map((run) => {
		const sites = run.map(({ cellId }) => cell(cellId));
		const columns = sites.map(({ column }) => column);
		const distance = sites.reduce(
			(sum, { center: [x, y] }) => sum + bankDistance(grid.terrain, x, y),
			0
		);
		return {
			west: Math.min(...columns),
			east: Math.max(...columns),
			offset: distance / sites.length
		};
	});
	expect(bounds.every(({ west, east }) => east - west < BLOCK.columns)).toBe(true);
	expect(bounds.slice(1).every(({ west }, i) => west - bounds[i].east > 1)).toBe(true);
	expect(
		Math.max(...bounds.map(({ offset }) => offset)) -
			Math.min(...bounds.map(({ offset }) => offset))
	).toBeGreaterThan(5);
	expect(new Set(runs.flat().flatMap(({ stories }) => stories)).size).toBeGreaterThan(1);
});

test('every form and rail anchor uses a buildable non-water cell beyond the reservations', () => {
	const { runs, satellite, railCellIds } = example();
	const ids = [...runs.flat(), ...satellite].map(({ cellId }) => cellId).concat(railCellIds);
	expect(new Set(ids).size).toBe(ids.length);
	for (const id of ids) {
		expect(cell(id).buildable).toBe(true);
		expect(cell(id).zone).not.toBe('water');
		expect(reserved.has(id)).toBe(false);
	}
});

test('a different seed changes the layout on the same grid', () => {
	const alternate = planTownForms(grid, 8, reserved);
	assert(alternate);
	const footprints = (plan: ReturnType<typeof example>) =>
		plan.runs.map((run) => run.map(({ cellId }) => cellId));
	expect(footprints(alternate)).not.toEqual(footprints(example()));
});

test('seeds 0 through 9 yield bank runs and an overland rail-linked satellite', () => {
	for (let seed = 0; seed < 10; seed++) {
		const grid = deriveGrid(createTerrain({ seed }));
		const plan = planTownForms(grid, seed, reserved);
		assert(plan, `Expected a town plan for seed ${seed}`);
		expect(plan.runs.length).toBeGreaterThan(0);
		expect(plan.satellite.length).toBeGreaterThan(0);
		const line = routeLine(grid, { id: 'example', kind: 'viaduct', cellIds: plan.railCellIds });
		assert(line, `Expected a rail link for seed ${seed}`);
		expect(line.path.every(([x, y]) => terrainZone(grid.terrain, x, y) !== 'water')).toBe(true);
	}
}, 30_000);
