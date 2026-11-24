import {
	cellSubgridCatalog,
	createCellSpace,
	createSubgridSpace,
	parcelEdgeId,
	type Parcel
} from '../cell-space';
import { createHouseCourt, createHouseObject, houseStyles, type HouseStyle } from './index';

// A small two-storey court house on a 14 x 14 m garden plot, fronting south, drawn as a block.
export function example() {
	const space = createCellSpace({
		id: 'garden-plot',
		corners: [
			{ id: 'a', position: [0, 0] },
			{ id: 'b', position: [14, 0] },
			{ id: 'c', position: [14, 14] },
			{ id: 'd', position: [0, 14] }
		],
		frontage: [parcelEdgeId('a', 'b')],
		baseZ: 0,
		storeyCount: 4
	});
	const house = createHouseCourt(space, { height: 7, width: 14, complexity: 0.2, seed: 7 });
	return createHouseObject(space, house, 'block');
}

const mixedStoreyParcel = {
	id: 'mixed-storey-plot',
	corners: [
		{ id: 'a', position: [0, 0] },
		{ id: 'b', position: [28, 0] },
		{ id: 'c', position: [28, 32] },
		{ id: 'd', position: [0, 32] }
	],
	frontage: [parcelEdgeId('a', 'b')],
	baseZ: 0,
	storeyCount: 4,
	storeyHeightsM: [4.8, 3.2, 3.2, 4.5]
} as const satisfies Parcel;

/** Builds a four-storey plot with the requested subgrid and house style. */
export function mixedStoreyExample(
	subgridId = 'corner-quad',
	catalog = cellSubgridCatalog,
	style: HouseStyle = houseStyles.neutral
) {
	const space = createSubgridSpace(mixedStoreyParcel, subgridId, {}, catalog);
	const house = createHouseCourt(
		space,
		{ height: 15.7, width: 28, complexity: 0.8, seed: 7 },
		style
	);
	return { space, house, object: createHouseObject(space, house, 'full', style) };
}
