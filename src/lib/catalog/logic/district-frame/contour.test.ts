// @ts-expect-error Bun provides its test API at runtime.
import { expect, test } from 'bun:test';
import { deriveGrid, regrid } from '../terrain-grid';
import { createTerrain } from '../terrain';
import { required } from '../required';
import { districtFrame } from './index';

test('a basin edit moves shared frame axes with the contour grid and preserves distant spans', () => {
	const terrain = { ...createTerrain({ seed: 11 }), along: 100, across: 100 };
	const grid = deriveGrid(terrain);
	const near = required(grid.cellsById.get('4/4'), 'basin parcel');
	const far = '17/17';
	const state = new Map(
		grid.cells.map((cell) => [
			cell.id,
			{
				id: cell.id,
				neighbors: cell.neighbors,
				form: 'house',
				protected: true,
				district: cell.block
			}
		])
	);
	const local = regrid(grid, {
		...terrain,
		edits: [{ kind: 'basin', center: [near.center[0], near.center[1]], radius: 9 }]
	});
	const before = districtFrame([near.id], state, grid.cellsById);
	const after = districtFrame([near.id], state, local.cellsById);
	expect(before.length).toBe(4);
	expect(after.map((edge) => edge.id)).toEqual(before.map((edge) => edge.id));
	expect(after.map((edge) => edge.axis)).not.toEqual(before.map((edge) => edge.axis));
	expect(districtFrame([far], state, local.cellsById)).toEqual(
		districtFrame([far], state, grid.cellsById)
	);
});
