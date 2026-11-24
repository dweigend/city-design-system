import { createPolygonIndex } from './index';

/** An L-shaped holding and its inset neighbor, in horizontal meters. */
export function example() {
	return createPolygonIndex([
		{
			id: 'holding',
			outline: [
				[0, 0],
				[3, 0],
				[3, 1],
				[1, 1],
				[1, 3],
				[0, 3]
			]
		},
		{
			id: 'neighbor',
			outline: [
				[1, 1],
				[3, 1],
				[3, 3],
				[1, 3]
			]
		}
	]);
}
