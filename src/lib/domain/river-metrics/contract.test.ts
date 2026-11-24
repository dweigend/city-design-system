import { expect, test } from 'bun:test';
import { clipPolylineToSquare, measureRiver, measureRiverSurface, sinuosity } from './index';

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

test('reports metric lengths, widths and wavelength for an independent repeating course', () => {
	const xy = [0, 0, 1, -1, 2, 0, 3, 1, 4, 0, 5, -1, 6, 0];
	const river = { xy, wetWidth: 1, bankfullWidth: 2, bearing: 0 };
	const result = measureRiver(river);
	expect(result.valleyLength).toBe(6);
	expect(result.riverLength).toBeCloseTo(6 * Math.SQRT2);
	expect(result.sinuosity).toBeCloseTo(Math.SQRT2);
	expect(result.wavelengthToWidth).toBeCloseTo(2 * Math.SQRT2);
	expect(measureRiver({ ...river, xy: [0, 0, 6, 0] }).wavelength).toBeNull();
	expect(xy).toEqual([0, 0, 1, -1, 2, 0, 3, 1, 4, 0, 5, -1, 6, 0]);
});

const surfaceGrid = {
	windowM: 2,
	spacingM: 1,
	bedMm: Array<number>(9).fill(1000),
	meanWaterMm: Array<number>(9).fill(0)
};
const surfaceCourse = [-1, 0, 1, 0] as const;
const surfaceProtocol = {
	reliefCoreM: 2,
	surfaceSpacingM: 1,
	smoothingSigmaM: 1,
	gaussianTruncateSigma: 2,
	profileSpacingM: 1,
	profileHalfLengthM: 1,
	stationOffsetM: 0,
	stationTangentHalfLengthM: 1,
	stepMinimumSlope: 0.2,
	stepMinimumGainM: 1,
	landSlopeClassLimits: [0.1, 0.2, 0.4]
} as const;

test.each([
	['bedMm', NaN],
	['meanWaterMm', Infinity],
	['floor', undefined]
] as const)('identifies the invalid %s raster sample', (field, invalid) => {
	const raster = Array<number>(9).fill(0);
	if (invalid === undefined) delete raster[4];
	else raster[4] = invalid;
	expect(() =>
		measureRiverSurface({ ...surfaceGrid, [field]: raster }, surfaceCourse, surfaceProtocol)
	).toThrow(field + '[4]');
});

test.each([
	['surfaceSpacingM', NaN],
	['profileSpacingM', Infinity],
	['stationTangentHalfLengthM', Infinity]
] as const)('rejects an invalid %s before measuring', (field, invalid) => {
	expect(() =>
		measureRiverSurface(surfaceGrid, surfaceCourse, { ...surfaceProtocol, [field]: invalid })
	).toThrow(field);
});

test.each([
	[0.2, 0.1, 0.4],
	[0.1, 0.2, Infinity]
] as const)('rejects slope limits %j before classifying land', (a, b, c) => {
	expect(() =>
		measureRiverSurface(surfaceGrid, surfaceCourse, {
			...surfaceProtocol,
			landSlopeClassLimits: [a, b, c]
		})
	).toThrow('landSlopeClassLimits');
});

test('classifies a flat dry raster entirely in the lowest slope band', () => {
	expect(measureRiverSurface(surfaceGrid, surfaceCourse, surfaceProtocol)).toMatchObject({
		reliefM: 0,
		landSlopeShares: [1, 0, 0, 0]
	});
});
