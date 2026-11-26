import { required } from '../../core/invariant';
import type { Vec2 } from '../../core/geometry';
import { createCityLattice, type CityColumn } from '../../domain/city-volume';
import {
	createParcelHouse,
	createParcelHouseFrame,
	createTownHouseStudy,
	readFineCells,
	type ParcelHouseSite
} from './index';

// The first parcel on the default Town's perimeter block.
export function example() {
	const town = createTownHouseStudy();
	const parcel = required(town.parcelsByBlock.get(town.blocks.block.id)?.[0], 'town parcel');
	const site = required(town.readParcelSite(parcel.id), 'parcel site');
	return createParcelHouse(site, { height: 14, width: 30, complexity: 0.5, seed: 4 });
}

/** Reads the mixed-height fine cells of two adjacent canonical bays at a fixed datum. */
export function fineCellsExample() {
	const corners = [
		{ id: 'a', position: [0, 0, 10] },
		{ id: 'b', position: [10, 0, 10] },
		{ id: 'c', position: [10, 10, 10] },
		{ id: 'd', position: [0, 10, 10] },
		{ id: 'e', position: [20, 0, 10] },
		{ id: 'f', position: [20, 10, 10] }
	] as const;
	const [a, b, c, d, e, f] = corners;
	const lattice = createCityLattice(
		[
			{
				planCellId: 'west',
				corners: [a, b, c, d],
				neighbors: [null, 'east', null, null],
				levels: 2
			},
			{
				planCellId: 'east',
				corners: [b, e, f, c],
				neighbors: [null, null, null, 'west'],
				levels: 2
			}
		],
		10,
		'box'
	);
	const recipe = { storeyHeightsM: [3, 4] };
	return {
		lattice,
		west: readFineCells(lattice, 'west/level/0', 'fine-example', recipe),
		east: readFineCells(lattice, 'east/level/0', 'fine-example', recipe)
	};
}

function stockParcel(id: string, x: number): ParcelHouseSite {
	const side = 12;
	const outline: readonly Vec2[] = [
		[x, 0],
		[x + side, 0],
		[x + side, side],
		[x, side]
	];
	const corners = outline.map((position, i) => ({ id: String(i), position }));
	const area = side * side;
	const portalId = id + '/portal';
	const blockId = id + '/block';
	const column: CityColumn = {
		planCellId: id,
		corners: corners.map(({ id, position }) => ({ id, position: [...position, 0] })),
		neighbors: [null, null, null, null],
		levels: 2,
		districtId: 'stock',
		densityRegionId: 'stock',
		kind: 'block',
		planScope: 'frame-example'
	};
	return {
		parcel: {
			id,
			blockId,
			splitPath: [],
			plannedKind: 'stock',
			publicUse: false,
			outline,
			corners,
			areaM2: area,
			portalId
		},
		portal: {
			id: portalId,
			parcelId: id,
			side: ['0', '1'],
			laneId: 'lane',
			points: [outline[0], outline[1]],
			frontageM: side
		},
		block: {
			id: blockId,
			memberCellIds: [id],
			plannedKind: 'stock',
			nodeIds: corners.map(({ id }) => id),
			outline,
			laneIds: ['lane'],
			grossAreaM2: area,
			laneAreaM2: 0,
			laneGround: [],
			netGround: [[outline]],
			parcelableGround: [[outline]],
			courtFit: 'not-planned',
			publicGround: { court: [], passage: [], open: [] },
			accounting: { parcelAreaM2: area, passageAreaM2: 0, courtAreaM2: 0, openAreaM2: 0 }
		},
		columns: new Map([[id, column]]),
		datumZ: 0,
		linearToleranceM: 0,
		groundAt: () => 0,
		recipe: { subgridId: 'corner-quad', subgridOptions: { refinementRounds: 0 } }
	};
}

/** Bridges the flat frontage roofs of two independent parcel houses. */
export function parcelFrameExample(groundAt: (point: Vec2) => number = () => 0) {
	const houses = [stockParcel('west-house', -9), stockParcel('east-house', 5)].map((site) => {
		const placed = createParcelHouse(site, { seed: 4, height: 7, width: 12, complexity: 0 });
		if (placed.status !== 'placed') throw new Error(placed.reason);
		return placed;
	});
	return createParcelHouseFrame({
		id: 'stock-bridge',
		start: [-6, 3],
		end: [8, 3],
		deckZ: 9,
		widthM: 3,
		houses,
		groundAt,
		allowPiers: false
	});
}
