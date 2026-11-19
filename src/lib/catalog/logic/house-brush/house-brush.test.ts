// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { STORY } from '../../data/grid';
import { bayOf } from './megastructure-bay';
import { guest } from './megastructure-guests';
import type { Primitive } from '../parametrik/types';
import { quadGrid, squareGrid, type QuadCell } from '../quad-grid';
import { houseChunk, lower, raise, stackTop, touchedChunks, type Stacks } from './index';

const SEED = 7;
const grid = squareGrid(12, 12, 5, 4);
const EMPTY: Stacks = new Map();
function cellAt(column: number, row: number) {
	const cell = grid.cellsById.get(`${column}/${row}`);
	if (!cell) throw new Error('fixture missing');
	return cell;
}
const parts = (stacks: Stacks, cell: QuadCell, on = grid) =>
	houseChunk(on, stacks, cell.chunk, SEED);
const named = (list: Primitive[], suffix: string) => list.filter((p) => p.id.endsWith(suffix));
const allChunks = (stacks: Stacks) =>
	new Map(
		[...grid.chunks.keys()].map((c) => [c, JSON.stringify(houseChunk(grid, stacks, c, SEED))])
	);
/** The same grid with one cell changed, e.g. skewed or flooded. */
const withCell = (id: string, change: (cell: QuadCell) => QuadCell) =>
	quadGrid(grid.cells.map((cell) => (cell.id === id ? change(cell) : cell)));

describe('house brush', () => {
	test('stock has pale pencil walls, pitched ridges and neutral openings', () => {
		const cell = cellAt(1, 1);
		const list = parts(raise(EMPTY, cell.id, 'water'), cell);
		expect(list.every((p) => p.role === 'bestand' && p.token === '--paper')).toBe(true);
		expect(named(list, ':wall')[0]).toMatchObject({ kind: 'prism', z: cell.pad });
		expect(named(list, ':ridge')[0]).toMatchObject({ kind: 'polyline' });
		expect(named(list, ':foot')).toHaveLength(1);
	});

	test('neighbors merge into one mass; a covered mass loses its roof terrace', () => {
		let stacks = EMPTY;
		for (const column of [1, 2, 3]) stacks = raise(stacks, cellAt(column, 1).id, 'food');
		expect(named(parts(stacks, cellAt(1, 1)), ':wall')).toHaveLength(1);
		expect(named(parts(stacks, cellAt(1, 1)), ':tier0')).toHaveLength(1);
		stacks = raise(stacks, cellAt(2, 1).id, 'food');
		const list = parts(stacks, cellAt(1, 1));
		expect(named(list, ':wall')).toHaveLength(2);
		expect(named(list, ':tier0')).toHaveLength(1);
		expect(stackTop(stacks, cellAt(2, 1))).toBe(cellAt(2, 1).pad + 2 * STORY);
	});

	test('another use or another datum stays a separate mass', () => {
		const mixed = raise(raise(EMPTY, '1/1', 'food'), '2/1', 'energy');
		expect(named(parts(mixed, cellAt(1, 1)), ':wall')).toHaveLength(2);
		const stepped = withCell('2/1', (cell) => ({ ...cell, pad: cell.pad + 1 }));
		const same = raise(raise(EMPTY, '1/1', 'food'), '2/1', 'food');
		expect(named(parts(same, cellAt(1, 1), stepped), ':wall')).toHaveLength(2);
	});

	test('figures take their measure from the cell: a narrower cell, a lower pitched roof', () => {
		const narrow = withCell('1/1', (cell) => {
			const [a, b, c, d] = cell.corners;
			const half = (p: typeof a, q: typeof a): typeof a => [(p[0] + q[0]) / 2, p[1], p[2]];
			return {
				...cell,
				corners: [a, half(a, b), half(d, c), d],
				center: [a[0] + 1.25, cell.center[1], 0]
			};
		});
		const stacks = raise(EMPTY, '1/1', 'living');
		const height = (list: Primitive[]) => {
			const ridge = named(list, ':ridge')[0];
			return ridge.kind === 'polyline' ? ridge.points[0][2] : 0;
		};
		expect(height(parts(stacks, cellAt(1, 1), narrow))).toBeLessThan(
			height(parts(stacks, cellAt(1, 1)))
		);
	});

	test('the third story opens a ground arcade and its removal closes it again', () => {
		const cell = cellAt(1, 1);
		const two = raise(raise(EMPTY, cell.id, 'water'), cell.id, 'living');
		const three = raise(two, cell.id, 'food');
		const arcade = parts(three, cell).filter((p) => p.id.includes(':piloti'));
		expect(arcade).toHaveLength(4);
		expect(arcade.every((p) => p.kind === 'cylinder' && p.token === '--paper')).toBe(true);
		expect(parts(lower(three, cell.id), cell)).toEqual(parts(two, cell));
		expect(parts(two, cell).some((p) => p.id.includes(':piloti'))).toBe(false);
	});

	test('new living collage carries a white module and a pink access flight', () => {
		const cell = cellAt(1, 1);
		const list = houseChunk(grid, raise(EMPTY, cell.id, 'living'), cell.chunk, SEED, 'collage');
		expect(named(list, '/module')[0]).toMatchObject({ kind: 'capsule', token: '--paper' });
		expect(list.some((p) => p.id.includes(':step'))).toBe(true);
		expect(list.some((p) => p.pattern || p.token === '--signal')).toBe(false);
	});

	test('adjacent roof quads produce connected physical rods in both sections', () => {
		const stacks = raise(raise(EMPTY, '1/1', 'living'), '2/1', 'living');
		const list = houseChunk(grid, stacks, cellAt(1, 1).chunk, SEED, 'megastructure');
		expect(list.some((p) => p.kind === 'pipe' && p.radius === 0.09 && p.member === 'primary')).toBe(
			true
		);
		expect(
			list.some((p) => p.kind === 'pipe' && p.radius === 0.05 && p.member === 'secondary')
		).toBe(true);
	});
	test('where it floods, the house stands on a deck with stilts', () => {
		const wet = withCell('1/1', (cell) => ({ ...cell, raised: true, pad: 4.5 }));
		const list = parts(raise(EMPTY, '1/1', 'living'), cellAt(1, 1), wet);
		expect(named(list, ':foot')).toHaveLength(0);
		expect(named(list, ':deck')).toHaveLength(1);
		expect(list.filter((p) => p.id.includes(':stilt'))).toHaveLength(4);
	});

	test('a ring of cells encloses a courtyard', () => {
		let stacks = EMPTY;
		for (const [column, row] of [
			[5, 5],
			[6, 5],
			[7, 5],
			[7, 6],
			[7, 7],
			[6, 7],
			[5, 7],
			[5, 6]
		])
			stacks = raise(stacks, cellAt(column, row).id, 'material');
		const [wall] = named(parts(stacks, cellAt(5, 5)), ':wall');
		expect(wall.kind === 'prism' && wall.holes?.length).toBe(1);
	});

	test('a local edit touches exactly the chunks whose parts change', () => {
		let stacks = EMPTY;
		for (const column of [2, 3, 4, 5]) stacks = raise(stacks, cellAt(column, 3).id, 'living');
		const edits: [string, (s: Stacks) => Stacks][] = [
			['3/3', (s) => raise(s, '3/3', 'energy')],
			['4/3', (s) => lower(s, '4/3')],
			['9/9', (s) => raise(s, '9/9', 'water')]
		];
		for (const [id, edit] of edits) {
			const before = stacks;
			stacks = edit(stacks);
			const touched = touchedChunks(grid, before, stacks, [id]);
			const was = allChunks(before);
			for (const [chunk, json] of allChunks(stacks))
				if (json !== was.get(chunk)) expect(touched.has(chunk)).toBe(true);
		}
	});

	test('lowering an unbuilt cell and raising a full one are no-ops', () => {
		expect(lower(EMPTY, '1/1')).toBe(EMPTY);
		let full = EMPTY;
		for (let i = 0; i < 12; i++) full = raise(full, '1/1', 'living');
		expect(raise(full, '1/1', 'living')).toBe(full);
	});
});

test('a carrier crosses the chunk seam only above older roofs in its block', () => {
	const anchor = cellAt(3, 2);
	const current = raise(EMPTY, anchor.id, 'living');
	const occupied = raise(raise(current, '2/2', 'water'), '4/2', 'food');
	const context = {
		occupied,
		blockOf: () => 'one block',
		olderRoof: (id: string) => occupied.has(id) && !current.has(id)
	};
	const project = (blockOf: (id: string) => string) =>
		houseChunk(grid, current, anchor.chunk, SEED, 'totem', { ...context, blockOf }).filter((p) =>
			p.id.includes(':span/')
		);
	const span = project(context.blockOf);
	const chord = named(span, '/lower')[0];
	expect(chord.kind === 'pipe' && chord.points.length).toBe(3);
	expect(named(span, '/module')).toHaveLength(2);
	expect(
		project((id) => (id === '4/2' ? 'next block' : 'one block')).some((p) => p.id.includes('/4/2/'))
	).toBe(false);
	expect(touchedChunks(grid, current, current, ['4/2']).has(anchor.chunk)).toBe(true);
});

test('raised water vessels respect the wall clearance of a skewed mounting bay', () => {
	const cell = cellAt(1, 1);
	const story = { cell, level: 0 };
	const mass = { id: 'test', use: 'water' as const, floor: 0, raised: false, stories: [story] };
	const vessel = (depth: number) => {
		const bay = bayOf(mass, story, [
			[0, 0, 0],
			[8, 0, 0],
			[9, depth, 0],
			[1, depth, 0]
		]);
		const body = guest(bay, 'water', 0, true).find((p) => p.kind === 'sphere');
		if (body?.kind !== 'sphere') throw new Error('Missing mounted vessel');
		return body;
	};
	const narrow = vessel(2);
	expect(narrow.radius).toBeCloseTo(narrow.position[1], 10);
	expect(narrow.radius).toBeLessThan(vessel(8).radius);
});
