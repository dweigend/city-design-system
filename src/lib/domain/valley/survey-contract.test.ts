import { expect, test } from 'bun:test';
import { surveyGround } from './survey';

test('divides the centered survey exactly when the requested spacing does not divide the side', () => {
	for (const spacingM of [18, 19]) {
		const points: [number, number][] = [];
		const survey = surveyGround(
			(x, y) => {
				points.push([x, y]);
				return { height: x, water: x, bank: 160, waterKind: null, lakeId: null };
			},
			[],
			{ sideM: 100, spacingM, buildableSlope: 0.2 }
		);
		expect(points[0]).toEqual([-50, 50]);
		expect(points.at(-1)).toEqual([50, -50]);
		expect(points).toHaveLength(49);
		expect(survey.lowestM).toBe(-50);
		expect(survey.highestM).toBe(50);
	}
});
