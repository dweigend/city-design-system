// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { forestChunk, setCover, type Cover } from './index';

const grid = squareGrid(6, 6, 5, 6);
const EMPTY: Cover = new Map();
const forest = (ids: string[]) => ids.reduce((cover, id) => setCover(cover, id, 'forest'), EMPTY);
const trees = (cover: Cover) =>
	forestChunk(grid, cover, '0:0', 7).filter((p) => p.id.includes(':tree'));

describe('land cover', () => {
	test('setting the same cover again and clearing an empty cell are no-ops', () => {
		const cover = setCover(EMPTY, '1/1', 'field');
		expect(setCover(cover, '1/1', 'field')).toBe(cover);
		expect(setCover(EMPTY, '1/1', undefined)).toBe(EMPTY);
		expect(setCover(cover, '1/1', undefined).size).toBe(0);
	});

	test('only forest cells carry trees, and every tree stands inside its cell', () => {
		const cover = setCover(forest(['1/1']), '3/3', 'meadow');
		const list = trees(cover);
		expect(list).toHaveLength(1);
		const [tree] = list;
		const [x, y] = tree.kind === 'sphere' || tree.kind === 'cone' ? tree.position : [NaN, NaN];
		expect(x).toBeGreaterThan(-10);
		expect(x).toBeLessThan(-5);
		expect(y).toBeGreaterThan(-10);
		expect(y).toBeLessThan(-5);
	});

	test('the forest thins out at its edge: two trees inside, one at the rim', () => {
		const block = forest([1, 2, 3].flatMap((column) => [1, 2, 3].map((row) => `${column}/${row}`)));
		// Eight rim cells with one tree each, the enclosed center with two.
		expect(trees(block)).toHaveLength(10);
	});

	test('same seed, same forest', () => {
		const cover = forest(['2/2', '2/3']);
		expect(forestChunk(grid, cover, '0:0', 7)).toEqual(forestChunk(grid, cover, '0:0', 7));
		expect(forestChunk(grid, cover, '0:0', 8)).not.toEqual(forestChunk(grid, cover, '0:0', 7));
	});
});
test('a planted chunk uses all four crown geometries with unique part identities', () => {
	const cover = forest(grid.cells.map((cell) => cell.id));
	const parts = forestChunk(grid, cover, '0:0', 7);
	expect(new Set(parts.filter((p) => p.id.includes(':tree')).map((p) => p.kind))).toEqual(
		new Set(['sphere', 'cone', 'helix', 'box'])
	);
	expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
});
