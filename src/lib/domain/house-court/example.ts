import { createCellSpace, parcelEdgeId } from '../cell-space';
import { createHouseCourt, createHouseObject } from './index';

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
