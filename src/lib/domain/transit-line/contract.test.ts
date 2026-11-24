import { expect, test } from 'bun:test';
import { transitExample } from './example';
import { createStraightLevelTransitLine, railConstraints } from './index';

test('chooses a dry parallel corridor and clears the analytic slope', () => {
	const line = transitExample();
	expect(line?.points[0][1]).toBe(50);
	expect(line?.points[0][2]).toBeCloseTo(600 / 36 + railConstraints.railClearanceM);
	expect(line?.piers.every(({ base }) => Math.abs(base[1]) > 15)).toBe(true);
	expect(line?.stations[0].approachId).toBe('entrance');
	expect(line?.gradeRatio).toBeLessThanOrEqual(railConstraints.maximumGradeRatio);
	expect(line?.minimumRadiusM).toBeGreaterThanOrEqual(railConstraints.minimumRadiusM);
});

test('clears roof envelopes and seats on dry addressed anchors in an occupied area', () => {
	const line = createStraightLevelTransitLine({
		corridors: [
			[
				[0, 0],
				[120, 0]
			]
		],
		readGround: (_, y) => ({ heightM: 2, dryClearanceM: y }),
		readSpanUpperM: () => 2,
		obstacles: [
			{
				outline: [
					[30, -1],
					[40, -1],
					[40, 1],
					[30, 1]
				],
				topM: 21
			}
		],
		anchors: [
			{ id: 'pier', point: [60, 8] },
			{ id: 'wet', point: [0, -8] }
		],
		requiresAnchor: () => true,
		levels: { datumM: 1, spacingM: 7 },
		dockReachM: 0
	});
	expect(line?.points[0][2]).toBe(29);
	expect(line?.piers).toEqual([{ anchorId: 'pier', base: [60, 8, 2], top: [60, 0, 29] }]);
});

const span = [
	[0, 0],
	[120, 0]
] as const;

test('uses the span envelope for a ridge between the 0 m and 8 m survey points', () => {
	const line = createStraightLevelTransitLine({
		corridors: [span],
		readGround: (x) => ({ heightM: Math.max(0, 20 - 10 * Math.abs(x - 4)), dryClearanceM: 3 }),
		readSpanUpperM: ([a], [b]) => (a <= 4 && b >= 4 ? 20 : 0),
		dockReachM: 0
	});
	expect(line?.points[0][2]).toBe(27);
});

test('skips an unsupported corridor and returns undefined when none can bear the track', () => {
	const survey = {
		readGround: () => ({ heightM: 0, dryClearanceM: 3 }),
		readSpanUpperM: () => 0,
		requiresAnchor: ([, y]: readonly [number, number]) => y < 50,
		dockReachM: 0
	};
	expect(createStraightLevelTransitLine({ ...survey, corridors: [span] })).toBeUndefined();
	expect(
		createStraightLevelTransitLine({
			...survey,
			corridors: [
				span,
				[
					[0, 60],
					[120, 60]
				]
			]
		})?.points[0][1]
	).toBe(60);
});

test('pairs dry approaches with the actual bearing within dock reach', () => {
	for (const dry of [true, false]) {
		const line = createStraightLevelTransitLine({
			corridors: [span],
			readGround: (_, y) => ({ heightM: 0, dryClearanceM: y === 5 && !dry ? -1 : 3 }),
			readSpanUpperM: () => 0,
			requiresAnchor: () => true,
			anchors: [{ id: 'pier', point: [60, 0] }],
			catchments: [
				{
					id: 'dock',
					approaches: dry
						? [
								{ id: 'far', point: [40, 0] },
								{ id: 'near', point: [60, 5] }
							]
						: [{ id: 'near', point: [60, 5] }]
				}
			],
			dockReachM: 10
		});
		expect(line?.stations.map(({ approachId }) => approachId)).toEqual(dry ? ['near'] : []);
	}
});

test('tests the foundation itself when a fallback pier searches off axis', () => {
	expect(
		createStraightLevelTransitLine({
			corridors: [span],
			readGround: (_, y) => ({ heightM: 0, dryClearanceM: Math.abs(y) - 1 }),
			readSpanUpperM: () => 0,
			requiresAnchor: ([, y]) => y !== 0,
			dockReachM: 0
		})
	).toBeUndefined();
});
