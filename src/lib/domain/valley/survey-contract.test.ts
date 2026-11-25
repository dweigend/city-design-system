import { expect, test } from 'bun:test';
import { surveyValley, Valley } from './index';
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
			{ sideM: 100, spacingM, gentleSlopeLimit: 0.2 }
		);
		expect(points[0]).toEqual([-50, 50]);
		expect(points.at(-1)).toEqual([50, -50]);
		expect(points).toHaveLength(49);
		expect(survey.lowestM).toBe(-50);
		expect(survey.highestM).toBe(50);
	}
});

test('emits exact solve bounds for a 12 km survey at 152 m spacing', () => {
	const valley = Valley.create({ seed: 1201 });
	expect(
		surveyValley(valley, { sideM: 12000, spacingM: 152, gentleSlopeLimit: 0.2 }).reliefM
	).toBeGreaterThan(0);
});

test('weights lake samples by their areas inside the survey window', () => {
	const survey = surveyGround(
		() => ({ height: 0, water: 1, bank: -1, waterKind: 'lake', lakeId: 1 }),
		[],
		{ sideM: 100, spacingM: 19, gentleSlopeLimit: 0.2 }
	);
	expect(survey.lakeArea).toBeCloseTo(10000, 9);
});
