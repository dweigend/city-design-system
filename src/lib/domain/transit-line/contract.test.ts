import { expect, test } from 'bun:test';
import { transitExample } from './example';
import { createTransitLine, railConstraints } from './index';

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
	const line = createTransitLine({
		corridors: [
			[
				[0, 0],
				[120, 0]
			]
		],
		readGround: (_, y) => ({ heightM: 2, dryClearanceM: y }),
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
