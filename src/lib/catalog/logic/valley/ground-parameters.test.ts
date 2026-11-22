import { expect, test } from 'bun:test';
import { generateValley, sampleValley } from './index';

test('ground profile overrides affect the field and are detached from caller input', () => {
	const rise: [number, number] = [5, 5];
	const base = generateValley({ seed: 1201 });
	const changed = generateValley({
		seed: 1201,
		groundProfile: { firstRiseM: rise, valleySlope: 0 }
	});
	rise[0] = 80;
	expect(changed.axis.profile.firstRiseM).toEqual([5, 5]);
	expect(changed.floors[1].levelM - changed.floors[0].levelM).toBe(5);
	expect(changed.course.xy).toEqual(base.course.xy);
	const grid = { windowM: 2000, spacingM: 12.5 };
	expect(sampleValley(changed, grid).meanWaterMm.every((mm) => mm === 0)).toBe(true);
	expect(sampleValley(changed, grid).bedMm).not.toEqual(sampleValley(base, grid).bedMm);
});

test('samples terrace setbacks, heights and axis tilt independently', () => {
	const seed = 1201;
	const base = generateValley({ seed });
	const widths = generateValley({ seed, parameters: { groundVariation: [0, 0] } });
	const heights = generateValley({ seed, parameters: { groundHeightVariation: [0, 0] } });
	const tilt = generateValley({ seed, parameters: { axisTiltRad: [0.05, 0.05] } });
	expect(widths.axis.openEdgeM).not.toBe(base.axis.openEdgeM);
	expect(widths.floors).toEqual(base.floors);
	expect(heights.floors).not.toEqual(base.floors);
	expect(heights.axis.openEdgeM).toBe(base.axis.openEdgeM);
	expect(tilt.axis.tiltRad).toBe(0.05);
	expect(tilt.course.xy).toEqual(base.course.xy);
});

test('rejects invalid ground values before sampling', () => {
	for (const groundProfile of [
		{ axisReachM: 0 },
		{ closeEdgeM: [800, 800] as const },
		{ bankRunM: NaN }
	]) {
		expect(() => generateValley({ seed: 1201, groundProfile })).toThrow('invalid-valley-ground');
	}
});
