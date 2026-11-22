import { expect, test } from 'bun:test';
import { VALLEY_MEASUREMENT_PROTOCOL } from '../../data/valley-references';
import { clipPolylineToSquare, measureRiverSurface, sinuosity } from './index';

test('clips a straight line to its two interpolated border points', () => {
	const input = new Float64Array([-4, -2, 4, 2]);
	const reach = clipPolylineToSquare(input, 2);

	expect(reach).toEqual({ xy: new Float64Array([-1, -0.5, 1, 0.5]), borderHits: 2 });
	if (!reach) throw new Error('Expected a clipped reach');
	expect(sinuosity(reach.xy)).toBe(1);
	expect(reach.xy.buffer).not.toBe(input.buffer);
});

test('approximates the analytic semicircle ratio pi / 2 at fine sampling', () => {
	const intervals = 65_536;
	const xy = new Float64Array(2 * (intervals + 1));
	for (let i = 0; i <= intervals; i++) {
		const angle = (Math.PI * i) / intervals;
		xy[2 * i] = Math.cos(angle);
		xy[2 * i + 1] = Math.sin(angle);
	}
	expect(Math.abs(sinuosity(xy) - Math.PI / 2)).toBeLessThan(1e-9);
});

test('agrees with independent Simpson quadrature for one period of a sine', () => {
	const intervals = 4096;
	const step = (2 * Math.PI) / intervals;
	const xy = new Float64Array(2 * (intervals + 1));
	for (let i = 0; i <= intervals; i++) {
		const x = i * step;
		xy[2 * i] = x;
		xy[2 * i + 1] = Math.sin(x);
	}

	const speed = (x: number) => Math.sqrt(1 + Math.cos(x) ** 2);
	let weightedSpeed = speed(0) + speed(2 * Math.PI);
	for (let i = 1; i < intervals; i += 2) weightedSpeed += 4 * speed(i * step);
	for (let i = 2; i < intervals; i += 2) weightedSpeed += 2 * speed(i * step);
	const expected = (step * weightedSpeed) / (3 * 2 * Math.PI);

	expect(Math.abs(sinuosity(xy) - expected)).toBeLessThan(1e-6);
});

test('keeps the longest contiguous reach and the first when lengths tie', () => {
	const xy = [-2, -0.5, 2, -0.5, 2, 2, 0, 0, -2, 2];
	expect(clipPolylineToSquare(xy, 2)).toEqual({
		xy: new Float64Array([1, 1, 0, 0, -1, 1]),
		borderHits: 2
	});
	expect(clipPolylineToSquare([-2, 0, 2, 0, 2, 0.5, -2, 0.5], 2)?.xy).toEqual(
		new Float64Array([-1, 0, 1, 0])
	);
});

test('handles border contacts and rejects degenerate measurements', () => {
	expect(clipPolylineToSquare([-2, 2, 0, 0, 2, 2], 2)?.borderHits).toBe(2);
	expect(clipPolylineToSquare([-2, 0, 0, 1, 2, 0], 2)?.borderHits).toBe(3);
	expect(clipPolylineToSquare([-2, 1, 2, 1], 2)?.borderHits).toBe(Infinity);
	expect(clipPolylineToSquare([0, 2, 2, 0], 2)).toBeNull();
	expect(() => clipPolylineToSquare([0, 0, 1, 1], 0)).toThrow('invalid-window');
	expect(() => sinuosity([0, 0, 0, 0])).toThrow('invalid-polyline');
	expect(() => sinuosity([0, 0, NaN, 1])).toThrow('invalid-polyline');
	expect(() => sinuosity([0, 0, 1, 0, 0, 0])).toThrow('zero-chord');
});

test('measures a sub-cell bank crossing and detects separate rises on both banks', () => {
	const windowM = 2000;
	const spacingM = 12.5;
	const side = windowM / spacingM + 1;
	const meanWaterMm = new Int32Array(side ** 2);
	const bedMm = meanWaterMm.map((_, index) => {
		const distance = Math.abs(windowM / 2 - Math.floor(index / side) * spacingM);
		const bankMm = Math.max(-3000, Math.min(1000, (distance - 177.5) * 100));
		return bankMm + (distance >= 387.5 ? 8000 : 0);
	});
	const floor = Uint8Array.from(bedMm, (bed) => (bed < 0 ? 0 : bed > 1000 ? 2 : 1));
	const result = measureRiverSurface(
		{ windowM, spacingM, bedMm, meanWaterMm, floor },
		[-2000, 0, 2000, 0],
		VALLEY_MEASUREMENT_PROTOCOL
	);
	expect(result.widthM).toEqual(Array<number>(8).fill(355));
	expect(result.bankPairsM).toEqual(Array<readonly [number, number]>(8).fill([203.75, 203.75]));
	expect(result.stepHeightsM).toHaveLength(16);
	for (const height of result.stepHeightsM) {
		expect(height).toBeGreaterThan(4);
		expect(height).toBeLessThan(8);
	}
	expect(result.reliefM).toBeCloseTo(9, 2);
	expect(result.landSlopeShares.reduce((total, share) => total + share)).toBeCloseTo(1, 12);
});

test('records a terrace at the wet bank even with the opposite terrace censored', () => {
	const windowM = 2000;
	const spacingM = 12.5;
	const side = windowM / spacingM + 1;
	const yAt = (i: number) => windowM / 2 - Math.floor(i / side) * spacingM;
	const meanWaterMm = new Int32Array(side ** 2);
	const bedMm = meanWaterMm.map((_, i) => (Math.abs(yAt(i)) <= 175 ? -1000 : 1000));
	const floor = Uint8Array.from(bedMm, (bed, i) => (bed < 0 ? 0 : yAt(i) > 175 ? 2 : 1));
	const metrics = measureRiverSurface(
		{ windowM, spacingM, bedMm, meanWaterMm, floor },
		[-2000, 0, 2000, 0],
		VALLEY_MEASUREMENT_PROTOCOL
	);
	expect(metrics.bankPairsM).toHaveLength(0);
	expect(metrics.dryBankWidthsM).toEqual(Array<number>(8).fill(0));
});
