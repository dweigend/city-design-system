import { describe, expect, test } from 'bun:test';
import { subdivideBay, type LatticeBay } from '../../domain/city-volume';
import { houseFigures } from '../../domain/house-court';
import { example } from './example';
import { readBaseLevel, readChildBayAddress } from './index';

describe('createBayHouse', () => {
	test('R11-09: the house stands on the first lattice plane above the highest corner', () => {
		const { space, house, baseLevel } = example();
		expect(baseLevel).toBe(2);
		expect(space.baseZ).toBe(14);
		expect(space.storeyCount).toBe(4);
		expect(house.storeys).toBe(4);
		expect(houseFigures(space, house).courtAreaM2).toBeGreaterThan(0);
	});

	test('fine cells resolve to the absolute child bay addresses of subdivideBay', () => {
		const { space, baseLevel } = example();
		const addresses = new Set(
			[baseLevel, baseLevel + 1].flatMap((level) => {
				const bay: LatticeBay = {
					id: `plan/7/level/${level}`,
					planCellId: 'plan/7',
					level,
					planCorners: ['v1', 'v2', 'v3', 'v4'],
					floorFace: '',
					ceilingFace: '',
					sideFaces: []
				};
				return subdivideBay(bay).map(({ id }) => id);
			})
		);
		for (const cell of space.cells)
			for (let storey = 0; storey < space.storeyCount; storey += 1)
				expect(addresses.has(readChildBayAddress('plan/7', baseLevel, cell, storey))).toBe(true);
		expect(readBaseLevel).toBeInstanceOf(Function);
	});
});
