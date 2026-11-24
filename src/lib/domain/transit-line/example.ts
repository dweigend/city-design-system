import {
	createStraightLevelTransitLine,
	createRailPierObject,
	createStationPlatformObject
} from './index';

/** A level guideway over an analytic slope with a shallow flooded band. */
export function transitExample() {
	return createStraightLevelTransitLine({
		corridors: [
			[
				[0, 0],
				[600, 0]
			],
			[
				[0, 50],
				[600, 50]
			]
		],
		readGround: (x, y) => ({ heightM: x / 36, dryClearanceM: Math.abs(y) - 15 }),
		readSpanUpperM: (a, b) => Math.max(a[0], b[0]) / 36,
		catchments: [{ id: 'orchard', approaches: [{ id: 'entrance', point: [100, 60] }] }],
		dockReachM: 30
	});
}

/** An offset pier and one platform on a horizontal track axis. */
export function example() {
	return {
		pier: createRailPierObject('bearing', [0, 0, 0], [2, 0, 8]),
		station: createStationPlatformObject('station', [2, 0, 8], [3, 4])
	};
}
