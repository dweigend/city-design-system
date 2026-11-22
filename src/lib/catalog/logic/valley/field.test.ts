import { expect, test } from 'bun:test';
import { contains, generateValley, groundAt, meanWaterAt, sampleValley } from './index';

const grid = { windowM: 2000, spacingM: 12.5 } as const;
const valley = generateValley({ seed: 1201 });

test('samples both endpoints, row zero north and the center at the water datum', () => {
	const field = sampleValley(valley, grid);
	const { bedMm, meanWaterMm, floor, classes } = field;
	for (const values of [bedMm, meanWaterMm, floor, classes]) expect(values).toHaveLength(161 ** 2);
	expect(groundAt(field, -1000, 1000)).toBe(bedMm[0] / 1000);
	expect(groundAt(field, 1000, -1000)).toBe(bedMm[161 ** 2 - 1] / 1000);
	expect(groundAt(field, -987.5, 975)).toBe(bedMm[323] / 1000);
	expect(groundAt(field, -993.75, 1000)).toBe((bedMm[0] + bedMm[1]) / 2000);
	expect(meanWaterAt(field, 0, 0)).toBe(0);
	const middle = (valley.course.chainageM.length - 1) / 2;
	const [x, y] = valley.course.xy.subarray(2 * middle, 2 * middle + 2);
	expect(groundAt(field, x, y)).toBeLessThan(meanWaterAt(field, x, y));
});

test('assigns water and terrace bits from the quantized field and detaches all buffers', () => {
	const field = sampleValley(valley, grid);
	sampleValley(generateValley({ seed: 1301 }), grid);
	const replay = sampleValley(valley, grid);
	expect(Object.isFrozen(field)).toBe(true);
	for (const name of ['bedMm', 'meanWaterMm', 'floor', 'classes'] as const) {
		expect(field[name]).toEqual(replay[name]);
		expect(field[name].buffer).not.toBe(replay[name].buffer);
	}
	for (let i = 0; i < field.floor.length; i++) {
		const level = field.floor[i];
		const wet = field.bedMm[i] < field.meanWaterMm[i];
		expect(level === 0).toBe(wet);
		expect(field.classes[i]).toBe([1, 2, 4, 36][level]);
	}
});

test('rejects unsupported grids and coordinates outside the closed sampling window', () => {
	expect(() => sampleValley(valley, { ...grid, spacingM: 25 })).toThrow('invalid-valley-grid');
	const field = sampleValley(valley, grid);
	expect(contains(field, 1000, -1000)).toBe(true);
	for (const x of [-1000.001, 1000.001, Infinity, NaN]) {
		expect(contains(field, x, 0)).toBe(false);
		for (const sample of [groundAt, meanWaterAt]) {
			expect(() => sample(field, x, 0)).toThrow(
				expect.objectContaining({ code: 'outside-window' })
			);
		}
	}
});

test('a straight northbound course lowers mean water toward row zero', () => {
	const north = generateValley({
		seed: 1201,
		bearingRad: Math.PI / 2,
		parameters: { headingAmplitude: [0, 0], axisTiltRad: [0, 0] }
	});
	const field = sampleValley(north, grid);
	expect(field.meanWaterMm[80]).toBe(-250);
	expect(field.meanWaterMm[160 * 161 + 80]).toBe(250);
});
