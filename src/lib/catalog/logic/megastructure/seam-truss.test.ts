import { expect, test } from 'bun:test';
import { bayAxes, trimBay, type BaySurvey } from './index';
const base: BaySurvey = { id: 'roof-1', a: [0, 0, 4], b: [4, 0, 4], back: [2, 3, 4] };
test('straight roof trestles return the trimmed service-probe sections and no remote brace', () => {
	const result = trimBay(base);
	expect(result.status).toBe('sized');
	if (result.status !== 'sized') throw new Error(result.reason);
	expect(result.sizing).toBe('ok');
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
test('a mechanism keeps both seated columns and its chord using nominal line weights', () => {
	const bay: BaySurvey = { ...base, back: [2, 0, 4] };
	expect(trimBay(bay)).toMatchObject({
		status: 'sized',
		sizing: 'mechanismus'
	});
	expect(bayAxes(bay).axes).toHaveLength(3);
});

test('a volume crossing the clear span rejects the physical axis before the load probe', () => {
	const volume = {
		z: 0,
		hoeheM: 8,
		polygon: [
			[1, -1],
			[3, -1],
			[3, 1],
			[1, 1]
		] as [number, number][]
	};
	const bay = { ...base, clearVolumes: [volume] };
	expect(trimBay(bay)).toMatchObject({
		status: 'rejected',
		reason: 'clearance',
		geometry: bay,
		element: bay.id,
		loadCase: 'service-probe'
	});
});

test('a crown below a footing cannot build an inverted column', () => {
	expect(trimBay({ ...base, crown: 3 })).toMatchObject({
		status: 'rejected',
		reason: 'no-bearing'
	});
});

test('the service probe can change only diameters on a buildable bay', () => {
	for (const bay of [base, { ...base, back: [2, 0, 4] as typeof base.back }]) {
		const service = trimBay(bay),
			nominal = trimBay(bay, 'nominal');
		if (service.status !== 'sized' || nominal.status !== 'sized')
			throw Error('Missing supported pair');
		expect(service.rods.map(({ id, a, b }) => ({ id, a, b }))).toEqual(
			nominal.rods.map(({ id, a, b }) => ({ id, a, b }))
		);
	}
});
