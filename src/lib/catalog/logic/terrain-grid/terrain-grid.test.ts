import { describe, expect, test } from 'bun:test';
import { createTerrain, groundLevel, valleyCoords, type TerrainEdit } from '../terrain';
import {
	defaultAlleyPlan,
	type TerrainCell,
	BLOCK,
	cellAtPoint,
	cellId,
	cellsBetween,
	deriveGrid,
	FLOOD_DATUM,
	MODULE,
	PLINTH,
	regrid
} from './index';

const terrain = createTerrain({ seed: 7 });
const grid = deriveGrid(terrain);
function cellAt(column: number, row: number) {
	const cell = grid.cellsById.get(cellId(column, row));
	if (!cell) throw new Error('fixture missing');
	return cell;
}
/** A cell on the scarp, away from the creek: here the rows must lie on the contours. */
const onScarp = grid.cells.filter(
	(cell) => cell.zone === 'scarp' && Math.abs(cell.column * MODULE - terrain.creekAlong) > 120
);

describe('terrain grid', () => {
	test('one cell per module of the valley frame; four counter-clockwise corners on every parcel', () => {
		expect(grid.columns).toBe(Math.floor(terrain.along / MODULE));
		expect(grid.rows).toBe(Math.floor(terrain.across / MODULE));
		expect(grid.cells.every((cell, i) => cell.index === i)).toBe(true);
		for (const cell of grid.cells) {
			expect(cell.corners).toHaveLength(4);
			const area = cell.corners.reduce((sum, p, i) => {
				const q = cell.corners[(i + 1) % cell.corners.length];
				return sum + (p[0] * q[1] - q[0] * p[1]) / 2;
			}, 0);
			for (const [i, p] of cell.corners.entries()) {
				const q = cell.corners[(i + 1) % cell.corners.length],
					s = cell.corners[(i + 2) % cell.corners.length];
				expect((q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0])).toBeGreaterThan(0);
			}
			expect(area).toBeGreaterThan(MODULE * MODULE * 0.3);
			expect(area).toBeLessThan(MODULE * MODULE * 3);
		}
	});

	test('on the slope a row follows the contour: its ends lie closer in height than the lattice', () => {
		let along = 0;
		let lattice = 0;
		for (const cell of onScarp) {
			const [a, b] = cell.corners;
			const d = cell.corners[cell.corners.length - 1];
			const level = (p: readonly number[]) => groundLevel(terrain, p[0], p[1]);
			along += Math.abs(level(b) - level(a));
			lattice += Math.abs(level(d) - level(a));
		}
		// Height change along a row against the change across it, per cell.
		expect(along / lattice).toBeLessThan(0.12);
	});

	test('scarp alleys improve on the previous contour solver for seed 7', () => {
		let along = 0,
			across = 0;
		for (const cell of onScarp.filter((cell) => cell.row % BLOCK.rows === 0)) {
			const [a, b] = cell.corners;
			const d = cell.corners[cell.corners.length - 1];
			const height = (p: typeof a) => groundLevel(terrain, p[0], p[1]);
			along += Math.abs(height(b) - height(a));
			across += Math.abs(height(d) - height(a));
		}
		// Same alley edges at 62862c9 measured 0.03365.
		expect(along / across).toBeLessThan(0.0336);
	});

	test('contour alleys respect block depths through the creek and the partial rim', () => {
		let greatestLean = 0;
		for (let column = 0; column <= grid.columns; column++) {
			const frame = (row: number) => {
				const [x, y] = grid.vertices[row * (grid.columns + 1) + column];
				return valleyCoords(terrain, x, y);
			};
			expect(frame(0)[1]).toBeCloseTo(0, 9);
			expect(frame(grid.rows)[1]).toBeCloseTo(grid.rows * MODULE, 9);
			for (let start = 0; start < grid.rows; start += BLOCK.rows) {
				if (cellAt(Math.min(column, grid.columns - 1), start).pattern !== 'contour') continue;
				const end = Math.min(start + BLOCK.rows, grid.rows);
				const step = (frame(end)[1] - frame(start)[1]) / (end - start);
				expect(step).toBeGreaterThanOrEqual(3 - 1e-9);
				expect(step).toBeLessThanOrEqual(7 + 1e-9);
				greatestLean = Math.max(greatestLean, Math.abs(frame(start)[0] - column * MODULE));
			}
		}
		expect(greatestLean).toBeGreaterThan(1);
		expect(greatestLean).toBeLessThanOrEqual(6 + 1e-9);
	});

	test('one-cell alley bands bound stable block addresses', () => {
		const widths = new Set(grid.cells.map((cell) => cell.plan.width));
		expect(widths.size).toBeGreaterThanOrEqual(5);
		expect(grid.cells.some((cell) => cell.plan.footbridge && cell.zone === 'water')).toBe(true);
		expect(grid.cells.some((cell) => cell.plan.square)).toBe(true);
		expect(grid.cells.some((cell) => cell.plan.stairAlley)).toBe(true);
		expect(cellAt(11, 7).block).toBe('0:0/10/6');
		expect(cellAt(12, 8).block).toBe('12:8/0/0');
		expect(cellAt(23, 15).block).toBe('12:8/10/6');
	});

	test('alley widths follow the world profile without changing parcel addresses', () => {
		const profile = { ...defaultAlleyPlan, mainAlleyWidth: 3 };
		const next = deriveGrid(terrain, profile);
		const main = grid.cells.find((cell) => cell.plan.width === defaultAlleyPlan.mainAlleyWidth);
		if (!main) throw new Error('missing main alley');
		expect(next.cellsById.get(main.id)?.plan.width).toBe(profile.mainAlleyWidth);
		expect(deriveGrid(terrain, profile).cellsById.get(main.id)?.plan).toEqual(
			next.cellsById.get(main.id)?.plan
		);
	});

	test('neighbors share their corners bit for bit', () => {
		const cell = cellAt(40, 60);
		for (const [side, id] of cell.neighbors.entries()) {
			const neighbor = grid.cellsById.get(id ?? '');
			const opposite = neighbor?.neighbors.indexOf(cell.id) ?? -1;
			expect(neighbor?.corners[opposite]).toBe(cell.corners[(side + 1) % 4]);
		}
		expect(cellAt(0, 0).neighbors).toEqual([null, '1/0', '0/1', null]);
	});

	test('level datums: no building on water, stilts where it floods, a plinth elsewhere', () => {
		for (const cell of grid.cells) {
			expect(cell.buildable).toBe(
				cell.parcelAccess !== 'landlocked' &&
					!cell.plan.open &&
					!cell.plan.square &&
					(cell.alley === null || !!cell.lotCorners)
			);
			if (cell.raised) expect(cell.pad).toBe(FLOOD_DATUM);
			else expect(cell.pad - PLINTH).toBe(Math.round(cell.pad - PLINTH));
		}
	});

	test('a ground point finds its cell; a stroke between two cells has no gaps', () => {
		for (const cell of [grid.cells[0], grid.cells[4321], grid.cells[grid.cells.length - 1]])
			expect(cellAtPoint(grid, cell.center[0], cell.center[1])).toBe(cell);
		expect(cellAtPoint(grid, 5000, 5000)).toBeUndefined();
		const stroke = cellsBetween(grid, '10/10', '14/12').map((cell) => cell.id);
		expect(stroke[0]).toBe('10/10');
		expect(stroke[stroke.length - 1]).toBe('14/12');
		expect(stroke).toHaveLength(7);
	});

	test('block patterns include curved fan rows, orthogonal terraces and irregular river parcels', () => {
		const patterns = new Map<string, TerrainCell['pattern']>();
		for (const cell of grid.cells) {
			expect(patterns.get(cell.block) ?? cell.pattern).toBe(cell.pattern);
			patterns.set(cell.block, cell.pattern);
		}
		expect(new Set(patterns.values())).toEqual(
			new Set(['orthogonal', 'contour', 'irregular', 'fan'])
		);
	});

	test('seed 7 retains the terrace reference, river displacement and curved fan frontages', () => {
		const frame = (c: number, r: number) => {
			const [x, y] = cellAt(c, r).corners[0];
			return valleyCoords(terrain, x, y);
		};
		// Formerly straight terrace alleys must change direction within three blocks.
		const y = Array.from({ length: 3 * BLOCK.columns + 1 }, (_, i) => frame(18 + i, 48)[1]);
		expect(Math.max(...y) - Math.min(...y)).toBeGreaterThan(MODULE / 2);
		expect(Math.abs(frame(30, 27)[0] - 30 * MODULE)).toBeGreaterThan(3);
		// The fan has a common pole 76 m below its central row in the valley frame.
		const pole = [42 * MODULE, 44 * MODULE - 76];
		for (const r of [44, 45])
			for (const c of [38, 42, 46]) {
				const [u, v] = frame(c, r);
				expect(
					Math.abs(Math.hypot(u - pole[0], v - pole[1]) - (76 + (r - 44) * MODULE))
				).toBeLessThan(MODULE * (defaultAlleyPlan.stagger * Math.SQRT2 + (r - 44) * 0.2));
			}
	});

	test('identical seeds produce identical quads in triangular, quadrilateral and pentagonal blocks', () => {
		const other = deriveGrid(createTerrain({ seed: 7 }));
		expect(other.cells).toEqual(grid.cells);
		expect(new Set(grid.cells.map((cell) => cell.blockSides))).toEqual(new Set([3, 4, 5]));
	});

	test('alleys bound whole source polygons and the concave pocket contains six quads', () => {
		const blocks = Map.groupBy(grid.cells, (c) => c.block);
		for (const [id, cells] of blocks) {
			const sides = cells[0].blockSides;
			expect(cells.length).toBe(id.includes('+') ? 3 * (sides - 2) : sides);
			for (const cell of cells) {
				cell.neighbors.forEach((neighbor, side) => {
					expect(Boolean(cell.alleyEdges & (1 << side))).toBe(
						grid.cellsById.get(neighbor ?? '')?.block !== id
					);
				});
			}
		}
		expect([...blocks.keys()].some((id) => id.includes('+'))).toBe(true);
	});

	test('organic sides and brush strokes agree with the shared topology', () => {
		for (const cell of grid.cells)
			cell.neighbors.forEach((id, i) => {
				if (!id) return;
				const neighbor = grid.cellsById.get(id);
				const side = neighbor?.neighbors.indexOf(cell.id) ?? -1;
				expect(neighbor?.vertexIds[side]).toBe(cell.vertexIds[(i + 1) % cell.corners.length]);
			});
		const path = cellsBetween(grid, '51/42', '68/54');
		expect(path[0].id).toBe('51/42');
		expect(path.at(-1)?.id).toBe('68/54');
		expect(path.slice(1).every((cell, i) => path[i].neighbors.includes(cell.id))).toBe(true);
		expect(
			grid.cells
				.filter(
					(c) =>
						c.column === 0 ||
						c.row === 0 ||
						c.column === grid.columns - 1 ||
						c.row === grid.rows - 1
				)
				.every((c) => !c.alley)
		).toBe(true);
	});

	test('repeating an edit recomputes its bank and preserves untouched chunk lists', () => {
		const [x, y] = cellAt(70, 40).center;
		const edit: TerrainEdit = { kind: 'basin', center: [x, y], radius: 9 };
		const once = regrid(grid, createTerrain({ edits: [edit] }));
		const terrain = createTerrain({ edits: [edit, edit] });
		const twice = regrid(once, terrain);
		expect(twice.chunks.get('0:0')).toBe(once.chunks.get('0:0'));
		expect(twice.cells.some((cell, i) => cell.center[2] !== once.cells[i].center[2])).toBe(true);
		expect(twice.cells).toEqual(deriveGrid(terrain).cells);
	});

	test('distant basins preserve the cells between their affected columns', () => {
		const edits = [12, 140].map((column): TerrainEdit => {
			const [x, y] = cellAt(column, 68).center;
			return { kind: 'basin', center: [x, y], radius: 9 };
		});
		const dug = createTerrain({ seed: 7, edits });
		const local = regrid(grid, dug);
		expect(local.cellsById.get('76/68')).toBe(cellAt(76, 68));
		expect(local.cells).toEqual(deriveGrid(dug).cells);
	});

	test('after an intervention the grid is derived only in reach and equals the full derivation', () => {
		const at = cellAt(70, 40).center;
		const edit: TerrainEdit = { kind: 'basin', center: [at[0], at[1]], radius: 9 };
		const dug = createTerrain({ seed: 7, edits: [edit] });
		const local = regrid(grid, dug);
		const full = deriveGrid(dug);
		expect(local.vertices).toEqual(full.vertices);
		expect(local.cells).toEqual(full.cells);
		const reused = local.cells.filter((cell, i) => cell === grid.cells[i]).length;
		expect(reused).toBeGreaterThan(grid.cells.length * 0.6);
		// Cells keep their identity: the anchor of everything painted survives.
		expect(local.cells.map((cell) => cell.id)).toEqual(grid.cells.map((cell) => cell.id));
		const water = (cells: typeof grid.cells) =>
			cells.filter((cell) => cell.zone === 'water').length;
		expect(water(local.cells)).toBeGreaterThan(water(grid.cells));
		// Taking the intervention back gives the first grid again.
		expect(regrid(local, terrain).cells).toEqual(grid.cells);
	});
});
