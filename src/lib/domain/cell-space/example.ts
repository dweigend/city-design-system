import { createCellSpace, parcelEdgeId, type Parcel } from './index';

// A 12 x 8 m corner plot of a garden lane, fronting its south edge, two storeys tall.
export function example() {
	return createCellSpace({
		id: 'lane/plot-3',
		corners: [
			{ id: 'sw', position: [0, 0] },
			{ id: 'se', position: [12, 0] },
			{ id: 'ne', position: [12, 8] },
			{ id: 'nw', position: [0, 8] }
		],
		frontage: [parcelEdgeId('sw', 'se')],
		baseZ: 0,
		storeyCount: 2
	});
}

/** One parcel for comparing subgrids with four differently sized storeys. */
export const mixedStoreyParcel = {
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
