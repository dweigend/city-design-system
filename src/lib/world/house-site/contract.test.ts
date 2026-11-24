import { describe, expect, test } from 'bun:test';
import { storeyAddress } from '../../domain/cell-space';
import { subdivideBay, type LatticeBay } from '../../domain/city-volume';
import { houseFigures } from '../../domain/house-court';
import { example } from './example';

describe('createBayHouse', () => {
	test('fills a city column with the court house on its highest corner', () => {
		const { space, house } = example();
		expect(space.baseZ).toBe(13);
		expect(space.storeyCount).toBe(4);
		expect(house.storeys).toBe(4);
		expect(houseFigures(space, house).courtAreaM2).toBeGreaterThan(0);
	});

	test('corner quads resolve the child bay addresses of the ground bay', () => {
		const { space } = example();
		const bay: LatticeBay = {
			id: 'plan/7/level/0',
			planCellId: 'plan/7',
			level: 0,
			planCorners: ['v1', 'v2', 'v3', 'v4'],
			floorFace: '',
			ceilingFace: '',
			sideFaces: []
		};
		const parents = new Set(space.cells.map(({ parent }) => parent));
		for (const { id } of subdivideBay(bay)) {
			const [corner, half] = JSON.parse(id.split('/child/')[1]) as [string, number];
			const parent = `plan/7/child/${JSON.stringify([corner])}`;
			expect(parents.has(parent)).toBe(true);
			expect(storeyAddress(parent, half)).toBe(`${parent}/storey/${half}`);
		}
	});
});
