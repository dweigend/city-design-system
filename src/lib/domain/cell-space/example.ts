import { createCellSpace, parcelEdgeId } from './index';

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
