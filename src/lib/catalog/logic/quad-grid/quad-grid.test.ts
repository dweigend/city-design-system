// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import {
	patchGrid,
	changedChunks,
	inradius,
	neighborsOf,
	quadGrid,
	sideLength,
	squareGrid
} from './index';

const grid = squareGrid(6, 4, 5, 2);

describe('quad grid', () => {
	test('a square grid: ids from the rule path, side neighbors in side order', () => {
		expect(grid.cells).toHaveLength(24);
		const cell = grid.cellsById.get('2/1');
		expect(cell?.neighbors).toEqual(['2/0', '3/1', '2/2', '1/1']);
		expect(grid.cellsById.get('0/0')?.neighbors).toEqual([null, '1/0', '0/1', null]);
		expect(cell && neighborsOf(grid, cell).map((n) => n.id)).toEqual(['2/0', '3/1', '2/2', '1/1']);
	});

	test('neighbors share vertex identities along their side', () => {
		const a = grid.cells[0];
		const b = grid.cells[1];
		expect(b.vertexIds[0]).toBe(a.vertexIds[1]);
		expect(b.vertexIds[3]).toBe(a.vertexIds[2]);
	});

	test('patch faces preserve ancestry, winding, side neighbors and common corners', () => {
		const vertices = Array.from({ length: 6 }, (_, i) => ({
			id: String(i),
			point: [i % 3, Math.floor(i / 3)] as const
		}));
		const patch = patchGrid({
			vertices,
			faces: [
				{ id: 'left', vertices: ['0', '1', '4', '3'], neighbors: [null, 'right', null, null] },
				{ id: 'right', vertices: ['1', '2', '5', '4'], neighbors: [null, null, null, 'left'] }
			]
		});
		const [left, right] = patch.cells;
		expect(left.center).toEqual([0.5, 0.5, 0]);
		expect(left.vertexIds).toEqual(['0', '1', '4', '3']);
		expect(left.corners[1]).toBe(right.corners[0]);
		expect(neighborsOf(patch, left)).toEqual([right]);
		expect(patch.cellsById.get('right')).toBe(right);
	});

	test('measures of a cell: side length and inscribed radius', () => {
		const cell = grid.cells[0];
		expect([0, 1, 2, 3].map((side) => sideLength(cell, side))).toEqual([5, 5, 5, 5]);
		expect(inradius(cell)).toBe(2.5);
	});

	test('chunks bucket the cells; replaced cells mark their chunks as changed', () => {
		expect(grid.chunks.size).toBe(6);
		expect(grid.chunks.get('0:0')?.map((cell) => cell.id)).toEqual(['0/0', '1/0', '0/1', '1/1']);
		const moved = quadGrid(grid.cells.map((cell) => (cell.id === '5/3' ? { ...cell } : cell)));
		expect([...changedChunks(grid, moved)]).toEqual(['2:1']);
		expect(changedChunks(grid, grid).size).toBe(0);
	});
});
