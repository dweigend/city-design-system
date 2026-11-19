import { expect, test } from 'bun:test';
import { createTerrain } from '../terrain';
import { deriveGrid, regrid, type TerrainGrid } from './index';

function basin(grid: TerrainGrid, id: string, radius: number) {
	const cell = grid.cellsById.get(id);
	if (!cell) throw new Error(id);
	const [x, y] = cell.center;
	return createTerrain({
		seed: grid.terrain.seed,
		edits: [{ kind: 'basin', center: [x, y], radius }]
	});
}
test('forty worlds support local basin edits including former startup failures 16, 25 and 38', () => {
	for (let seed = 0; seed < 40; seed++) {
		const grid = deriveGrid(createTerrain({ seed }));
		let previous = grid;
		for (const radius of [9, 18]) {
			const id = grid.cells[(seed * 1543 + radius * 271) % grid.cells.length].id;
			const edit = basin(previous, id, radius).edits[0];
			previous = regrid(
				previous,
				createTerrain({ seed, edits: [...previous.terrain.edits, edit] })
			);
			expect(previous.cells.length).toBe(grid.cells.length);
		}
	}
}, 120000);

for (const seed of [7, 11])
	test(
		'radius-nine basin sweep on terrain ' + seed,
		() => {
			const grid = deriveGrid(createTerrain({ seed }));
			for (const cell of grid.cells) {
				if (cell.column % 5 !== 2 || cell.row % 5 !== 2 || cell.zone === 'water') continue;
				expect(regrid(grid, basin(grid, cell.id, 9)).cells.length).toBe(grid.cells.length);
			}
		},
		120000
	);

test('local repair and undo preserve other patches and match full derivation', () => {
	const grid = deriveGrid(createTerrain({ seed: 11 }));
	const edited = basin(grid, '47/72', 9);
	const local = regrid(grid, edited);
	expect(local.cellsById.get('145/72')).toBe(grid.cellsById.get('145/72'));
	expect(local.cells).toEqual(deriveGrid(edited).cells);
	expect(regrid(local, grid.terrain).cells).toEqual(grid.cells);
});
