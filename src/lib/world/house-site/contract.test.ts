import { expect, test } from 'bun:test';
import { createCatalog } from '../../core/catalog';
import { required } from '../../core/invariant';
import {
	cellAreaM2,
	cellSubgridCatalog,
	createCellSpace,
	createStoreyStack,
	readCellStoreys,
	type CellSubgridGenerator
} from '../../domain/cell-space';
import { columnRoof, levelHeight } from '../../domain/city-volume';
import { houseFigures, houseStyles } from '../../domain/house-court';
import { example } from './example';
import { createParcelHouse, createParcelHouseObject, createTownHouseStudy } from './index';

test('the parcel example stays on its common lattice base', () => {
	const placed = example();
	if (placed.status !== 'placed') throw new Error(placed.reason);
	expect(placed.space.id).toBe(placed.parcel.id);
	expect(placed.space.storeyCount).toBeGreaterThan(0);
	expect(houseFigures(placed.space, placed.house).builtCells).toBeGreaterThan(0);
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

test('uses a custom parcel subgrid and repeats recipe heights from the coarse datum', () => {
	const town = createTownHouseStudy();
	const { id } = required(town.parcelsByBlock.get(town.blocks.block.id)?.[0], 'town parcel');
	const site = required(town.readParcelSite(id), 'parcel site');
	const subgridCatalog = createCatalog<CellSubgridGenerator>({
		rows: [
			...cellSubgridCatalog.rows,
			{
				id: 'coarse-quad',
				create: (parcel) => createCellSpace(parcel, 0)
			}
		]
	});
	const levelHeightM = 15.7;
	const storeyHeightsM = [4.8, 3.2, 3.2, 4.5];
	const recipe = {
		vertical: { levelHeightM, storeyHeightsM },
		subgridId: 'coarse-quad',
		subgridCatalog
	};
	const placed = createParcelHouse({ ...site, groundAt: undefined, recipe }, { seed: 3 });
	if (placed.status !== 'placed') throw new Error(placed.reason);
	expect(placed.space.storeyHeightsM.slice(0, 4)).toEqual(storeyHeightsM);
	expect(placed.space.cells.every(({ id, parent }) => id === parent)).toBe(true);
	const roof = Math.min(
		...site.block.memberCellIds.map((id) =>
			columnRoof(required(site.columns.get(id), 'parcel column'), site.datumZ, levelHeightM)
		)
	);
	expect(placed.space.storeyElevationsM.at(-1)).toBeCloseTo(roof);
	expect(createParcelHouseObject(placed, 'full').parts.length).toBeGreaterThan(0);
});

function parcelAtDatumZero(levels: number) {
	const town = createTownHouseStudy();
	const { id } = required(town.parcelsByBlock.get(town.blocks.block.id)?.[0], 'town parcel');
	const site = required(town.readParcelSite(id), 'parcel site');
	const columns = new Map(
		site.block.memberCellIds.map((id) => {
			const column = required(site.columns.get(id), 'parcel column');
			return [
				id,
				{
					...column,
					groundAtHub: 0,
					levels,
					corners: column.corners.map(({ id, position: [x, y] }) => ({
						id,
						position: [x, y, 0] as const
					}))
				}
			] as const;
		})
	);
	return { ...site, columns, datumZ: 0 };
}

test('starts terrain-aware houses on the exact plane and keeps their mixed height phase', () => {
	const site = parcelAtDatumZero(2);
	const groundZ = 3 * 3.2;
	const uniform = createParcelHouse(
		{
			...site,
			groundAt: () => groundZ,
			recipe: { vertical: { storeyHeightM: 3.2, storeysPerLevel: 4 } }
		},
		{ seed: 3 }
	);
	if (uniform.status !== 'placed') throw new Error(uniform.reason);
	expect(uniform.space.baseZ).toBe(groundZ);
	expect(uniform.space.storeyElevationsM.at(-1)).toBeCloseTo(25.6);

	const mixedGroundZ = 15.7 + (4.8 + 3.2);
	const mixed = createParcelHouse(
		{
			...site,
			groundAt: () => mixedGroundZ,
			recipe: { vertical: { levelHeightM: 15.7, storeyHeightsM: [4.8, 3.2, 3.2, 4.5] } }
		},
		{ seed: 3 }
	);
	if (mixed.status !== 'placed') throw new Error(mixed.reason);
	expect(mixed.space.baseZ).toBe(mixedGroundZ);
	expect(mixed.space.storeyHeightsM).toEqual([3.2, 4.5]);
	expect(mixed.space.storeyElevationsM.at(-1)).toBeCloseTo(31.4);
});

test('clips on the emitted mixed boundary at storey eleven and keeps the same storey ref', () => {
	const site = parcelAtDatumZero(4);
	const band = [4.8, 3.2, 3.2, 4.5];
	const storeyCount = 16;
	const stack = createStoreyStack({
		baseZ: 0,
		storeyCount,
		storeyHeightsM: Array.from({ length: storeyCount }, (_, index) => band[index % band.length])
	});
	const ground = stack.storeyElevationsM[11];
	expect(ground).toBe(42.6);
	const recipe = { vertical: { storeyHeightsM: band } };
	const tallerColumns = new Map(
		[...site.columns].map(([id, column]) => [id, { ...column, levels: column.levels + 1 }])
	);
	const clip = (columns = site.columns) =>
		createParcelHouse({ ...site, columns, recipe, groundAt: () => ground }, { seed: 3 });
	const initial = createParcelHouse({ ...site, recipe, groundAt: undefined }, { seed: 3 });
	const clipped = clip();
	const extended = clip(tallerColumns);
	if (initial.status !== 'placed' || clipped.status !== 'placed' || extended.status !== 'placed')
		throw new Error('Expected three placed houses');
	expect(clipped.space.baseZ).toBe(ground);
	expect(clipped.space.datumIndex).toBe(11);
	const [surviving] = readCellStoreys(clipped.space, 'test-town');
	expect(surviving.storey).toBe(0);
	const readSurvivor = (space: typeof initial.space) =>
		readCellStoreys(space, 'test-town').find(({ key }) => key === surviving.key);
	expect(readSurvivor(initial.space)?.ref).toEqual(surviving.ref);
	expect(readSurvivor(extended.space)?.ref).toEqual(surviving.ref);
	expect(readSurvivor(initial.space)?.bottomZ).toBe(surviving.bottomZ);
});

test('keeps a boundary supplied as the sum of fractional storey heights', () => {
	const ground = 0.1 + 0.2 + 0.3;
	const placed = createParcelHouse(
		{
			...parcelAtDatumZero(2),
			recipe: { vertical: { storeyHeightsM: [0.1, 0.2, 0.3] } },
			groundAt: () => ground
		},
		{ seed: 3 }
	);
	if (placed.status !== 'placed') throw new Error(placed.reason);
	expect(placed.space.baseZ).toBe(ground);
	expect(placed.space.datumIndex).toBe(3);
	expect(placed.space.storeyHeightsM).toEqual([0.1, 0.2, 0.3]);
});
