// @ts-expect-error Bun supplies its test API at runtime.
import { expect, test } from 'bun:test';
import { bayAxes, trimBay, type BaySurvey } from './index';
const base: BaySurvey = { id: 'roof-1', a: [0, 0, 4], b: [4, 0, 4], back: [2, 3, 4] };
test('straight roof trestles return the trimmed service-probe sections and no remote brace', () => {
	const result = trimBay(base);
	expect(result.status).toBe('sized');
	if (result.status !== 'sized') throw new Error(result.reason);
	for (const r of result.rods) {
		expect([0.1, 0.14, 0.18]).toContain(r.diameter);
		expect(Math.hypot(r.a[0] - r.b[0], r.a[1] - r.b[1])).toBeLessThanOrEqual(5);
	}
});
test('an obstructed chord rejects the service load case without lengthening a strut', () => {
	const bay: BaySurvey = {
		...base,
		gaps: [
			[
				[2, -1, 4],
				[2, 1, 4]
			]
		]
	};
	expect(trimBay(bay)).toMatchObject({
		status: 'rejected',
		reason: 'clearance',
		loadCase: 'service-probe'
	});
});
test('a corner without transverse restraint identifies the load case and singular element', () => {
	const bay: BaySurvey = { ...base, back: [2, 0, 4] };
	expect(trimBay(bay)).toMatchObject({
		status: 'rejected',
		reason: 'mechanismus',
		loadCase: 'service-probe'
	});
	expect(bayAxes(bay).axes).toHaveLength(3);
});
