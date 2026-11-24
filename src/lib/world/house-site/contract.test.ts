import { describe, expect, test } from 'bun:test';
import { cellAreaM2 } from '../../domain/cell-space';
import { levelHeight, subdivideBay, type LatticeBay } from '../../domain/city-volume';
import { houseFigures, houseStyles } from '../../domain/house-court';
import { example } from './example';
import {
	createParcelHouse,
	createParcelHouseObject,
	createTownHouseStudy,
	readBaseLevel,
	readChildBayAddress
} from './index';

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

test('each Town parcel takes an addressed house, including merged halls with sub-centimeter edges', () => {
	const { blocks, parcelsByBlock, portals, columns, layout, holdings } = createTownHouseStudy();
	const halls = holdings.blocks.filter(({ plannedKind }) => plannedKind === 'hall');
	expect(halls).toContain(blocks.merged);
	for (const block of [blocks.block, ...halls]) {
		const parcels = parcelsByBlock.get(block.id) ?? [];
		expect(parcels.length).toBeGreaterThan(0);
		if (block.plannedKind === 'hall') expect(parcels).toHaveLength(1);

		for (const parcel of parcels) {
			const portal = portals.get(parcel.portalId);
			if (!portal) throw new Error('Missing Town portal');
			const placed = createParcelHouse(
				{
					parcel,
					portal,
					block,
					columns,
					datumZ: layout.datumZ,
					linearToleranceM: holdings.linearToleranceM
				},
				{ seed: 3 },
				houseStyles.memphis
			);
			if (placed.status === 'unbuildable') throw Error(placed.reason);
			const { space, house, baseLevel } = placed;
			expect(space.id).toBe(parcel.id);
			expect(house.styleId).toBe(houseStyles.memphis.id);
			expect(space.baseZ).toBe(layout.datumZ + baseLevel * levelHeight);
			expect(
				space.cells.every(({ id }) => id.startsWith(encodeURIComponent(parcel.id) + '/'))
			).toBe(true);
			expect(space.cells.reduce((sum, cell) => sum + cellAreaM2(cell), 0)).toBeCloseTo(
				parcel.areaM2
			);
			expect(
				new Set(
					space.cells.flatMap(({ sides }) =>
						sides.filter(({ frontage }) => frontage).map(({ edge }) => edge)
					)
				).size
			).toBe(1);
			expect(houseFigures(space, house).builtCells).toBeGreaterThan(0);
			expect(
				createParcelHouseObject(placed, 'full').parts.some(({ slot }) => slot === 'plot')
			).toBe(true);
		}
	}
});

test('rotating the keyed parcel ring preserves its portal, strip IDs and occupancy', () => {
	const town = createTownHouseStudy();
	const parcel = town.parcelsByBlock.get(town.blocks.block.id)?.[0];
	const site = parcel && town.readParcelSite(parcel.id);
	if (!site) throw new Error('Expected a private Town parcel');
	const shift = <T>(ring: readonly T[]) => [...ring.slice(1), ring[0]];
	const inputs = { seed: 1201, height: 14, width: 28, complexity: 0.4 };
	const original = createParcelHouse(site, inputs);
	const rotated = createParcelHouse(
		{
			...site,
			parcel: {
				...site.parcel,
				outline: shift(site.parcel.outline),
				corners: shift(site.parcel.corners)
			}
		},
		inputs
	);
	if (original.status !== 'placed' || rotated.status !== 'placed') throw Error('Expected a house');
	expect(rotated.space.cells).toEqual(original.space.cells);
	expect(rotated.house).toEqual(original.house);
});
