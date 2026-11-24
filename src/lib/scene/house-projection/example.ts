import { createCellSpace, parcelEdgeId } from '../../domain/cell-space';
import { createHouseCourt, createHouseObject } from '../../domain/house-court';
import { houseDetailOf, projectHouse } from './index';

// A hexagonal corner plot drawn in pencil, as stock beside a focused subject.
export function example() {
	const corners = Array.from({ length: 6 }, (_, i) => {
		const angle = (i * Math.PI) / 3;
		return { id: `h${i}`, position: [12 * Math.cos(angle), 12 * Math.sin(angle)] as const };
	});
	const space = createCellSpace({
		id: 'hex-plot',
		corners,
		frontage: [parcelEdgeId('h4', 'h5')],
		baseZ: 0,
		storeyCount: 6
	});
	const house = createHouseCourt(space, { height: 10.5, width: 12, complexity: 0.4, seed: 11 });
	return projectHouse(createHouseObject(space, house, houseDetailOf('pencil')), 'pencil');
}
