import { expect, test } from 'bun:test';
import { crossSections } from './cross-profiles';
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

test('rejects station offsets whose increment stalls or whose count is unrepresentable', () => {
	for (const profileSpacingM of [Number.MIN_VALUE, 2 ** -40]) {
		expect(() =>
			measureRiverSurface(surfaceGrid, surfaceCourse, {
				...surfaceProtocol,
				stationOffsetM: 1,
				profileSpacingM
			})
		).toThrow('profileSpacingM');
	}
});

test('rejects profile offsets whose increment stalls or whose count is unrepresentable', () => {
	for (const profileHalfLengthM of [2 ** 54, 2 ** 32]) {
		expect(() =>
			measureRiverSurface(surfaceGrid, surfaceCourse, { ...surfaceProtocol, profileHalfLengthM })
		).toThrow('profileHalfLengthM');
	}
});

test('uses the supplied classifier to measure width to a different terrace class', () => {
	const grid = {
		windowM: 4,
		spacingM: 1,
		bedMm: [1000, 1000, -1000, 1000, 1000].flatMap((height) => Array(5).fill(height)),
		meanWaterMm: Array<number>(25).fill(0),
		floor: [1, 0, 0, 0, 1].flatMap((floor) => Array(5).fill(floor))
	};
	const course = [-2, 0, 2, 0];
	const protocol = { ...surfaceProtocol, profileHalfLengthM: 2 };
	expect(measureRiverSurface(grid, course, protocol).bankPairsM).toEqual([]);
	const custom = measureRiverSurface(grid, course, protocol, (floor) => floor === 1);
	expect(custom.bankPairsM.length).toBeGreaterThan(0);
	expect(custom.bankPairsM).toEqual(custom.widthM.map(() => [1, 1]));
});

test('visits the indexed station offsets when additions would round down cumulatively', () => {
	const spacing = 1.25 * Number.EPSILON;
	const end = 1 + 8 * Number.EPSILON;
	const offsets = crossSections([0, 0, end, 0], 1, spacing, 1).map((station) => station(0).x);
	expect(offsets).toEqual(Array.from({ length: 6 }, (_, index) => 1 + index * spacing));
});

test('allows one station immediately below a representable boundary', () => {
	const first = 2 - Number.EPSILON;
	const stations = crossSections([0, 0, 2, 0], first, Number.EPSILON, 1);
	expect(stations.map((station) => station(0).x)).toEqual([first]);
});

test('rejects excessive finite station counts before taking any samples', () => {
	let reads = 0;
	const xy = new Proxy([0, 0, 1 + 2 ** -20, 0], {
		get(target, key) {
			// Stop the first sample if the count guard was bypassed.
			if (key === '0' && reads++ > 0) throw Error('Unexpected profile sample');
			return Reflect.get(target, key);
		}
	});
	expect(() => crossSections(xy, 1, 1.25 * Number.EPSILON, 1)).toThrow('profileSpacingM');
});

test('rejects a finite profile with too many offsets even on a tiny raster', () => {
	expect(() =>
		measureRiverSurface(surfaceGrid, surfaceCourse, {
			...surfaceProtocol,
			profileHalfLengthM: 2 ** 26,
			stationOffsetM: 2
		})
	).toThrow('profileHalfLengthM');
});

test('limits the combined station and profile sample count', () => {
	expect(() => crossSections([0, 0, 2000, 0], 0, 1, 1, 1000)).toThrow('profileSpacingM');
});

test('rejects a repeated visited offset without rejecting a rounded endpoint', () => {
	expect(() => crossSections([0, 0, 1 + Number.EPSILON, 0], 1, Number.EPSILON / 4, 1)).toThrow(
		'advancing offsets'
	);
});

test('does not charge the excluded terminal station against the cross-profile budget', () => {
	expect(crossSections([0, 0, 200_000, 0], 0, 1, 1, 5)).toHaveLength(200_000);
});
