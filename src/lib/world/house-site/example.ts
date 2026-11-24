import type { CityColumn } from '../../domain/city-volume';
import { createBayHouse } from './index';

// A sloping quad column of a block district, two coarse levels tall, fronting its first edge.
export function example() {
	const column: CityColumn = {
		planCellId: 'plan/7',
		corners: [
			{ id: 'v1', position: [0, 0, 0] },
			{ id: 'v2', position: [58, 4, 1] },
			{ id: 'v3', position: [55, 61, 8] },
			{ id: 'v4', position: [-3, 57, 2] }
		],
		neighbors: [null, null, null, null],
		levels: 2,
		districtId: 'district/1',
		densityRegionId: 'region/1',
		kind: 'block'
	};
	return createBayHouse(column, 0, [0], { height: 14, width: 30, complexity: 0.5, seed: 4 });
}
