import { beforeAll, expect, test } from 'bun:test';
import { createTerrain, terrainHeight } from '../terrain';
import { deriveGrid, type TerrainGrid } from '.';
import { deriveGroundPlan } from './ground-plan';

const ANCHOR = '76/64';
let grid: TerrainGrid;

beforeAll(() => {
	grid = deriveGrid(createTerrain({ seed: 7 }));
});

test('the same plan seed reproduces geometry and sub-area IDs on the test terrain', () => {
	const plan = deriveGroundPlan(grid, ANCHOR, 104);
	expect(deriveGroundPlan(grid, ANCHOR, 104)).toEqual(plan);
	expect(plan.cells.length).toBeGreaterThan(200);
	expect(new Set(plan.areas.map(({ id }) => id)).size).toBe(plan.areas.length);
	for (const cell of plan.cells) {
		expect(cell.corners).toBe(grid.cellsById.get(cell.id)?.corners);
		for (const [x, y, z] of cell.corners) {
			expect(z).toBe(terrainHeight(grid.terrain, x, y));
		}
	}
	const elevations = plan.cells.map(({ center }) => center[2]);
	expect(Math.max(...elevations) - Math.min(...elevations)).toBeGreaterThan(2);
});

test('different plan seeds crop different geometry from the same carrier', () => {
	const a = deriveGroundPlan(grid, ANCHOR, 104);
	const b = deriveGroundPlan(grid, ANCHOR, 207);
	expect(a.boundary).not.toEqual(b.boundary);
	expect(a.cells.map(({ id }) => id)).not.toEqual(b.cells.map(({ id }) => id));
});

test.each([104, 207])(
	'seed %i keeps reserves connected by kind and free of building use',
	(seed) => {
		const plan = deriveGroundPlan(grid, ANCHOR, seed);
		const cells = new Map(plan.cells.map((cell) => [cell.id, cell]));
		const seen = new Set<string>();
		const paths = new Set(
			plan.areas.filter((area) => area.kind === 'path').flatMap((area) => area.cellIds)
		);
		const frontsPath = (id: string) =>
			cells.get(id)?.neighbors.some((neighbor) => neighbor !== null && paths.has(neighbor));
		for (const { kind, cellIds } of plan.areas) {
			const members = new Set(cellIds);
			const reached = new Set([cellIds[0]]);
			for (const id of reached) {
				for (const neighbor of cells.get(id)?.neighbors ?? []) {
					if (neighbor !== null && members.has(neighbor)) reached.add(neighbor);
				}
			}
			expect(reached).toEqual(members);
			for (const id of members) {
				expect(seen.has(id)).toBe(false);
				seen.add(id);
			}
			if (kind === 'buildable') expect(cellIds.every(frontsPath)).toBe(true);
			if (kind === 'plaza') expect(cellIds.some(frontsPath)).toBe(true);
		}
		expect(seen).toEqual(new Set(cells.keys()));
		expect(plan.areas.filter(({ kind }) => kind === 'path')).toHaveLength(1);
		expect(plan.areas.some(({ kind }) => kind === 'court')).toBe(true);
		expect(plan.areas.some(({ kind }) => kind === 'plaza')).toBe(true);
		expect(plan.areas.some(({ kind }) => kind === 'buildable')).toBe(true);
	}
);
