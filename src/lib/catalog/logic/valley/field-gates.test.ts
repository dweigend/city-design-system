import { expect, test } from 'bun:test';
import {
	LARGE_LOWLAND_MEASUREMENT_BANDS as bands,
	VALLEY_HOLDOUT_SEEDS,
	VALLEY_MEASUREMENT_PROTOCOL as protocol,
	VALLEY_REFERENCES,
	VALLEY_X1_SEEDS
} from '../../data/valley-references';
import { measureRiverSurface } from '../river-metrics';
import { DEFAULT_VALLEY_PARAMETERS, generateValley, sampleValley, type Valley } from './index';

function measure(valley: Valley) {
	const field = sampleValley(valley, {
		windowM: protocol.localWindowM,
		spacingM: protocol.fieldSpacingM
	});
	return measureRiverSurface(field, valley.course.xy, protocol);
}

type Measurements = ReturnType<typeof measure>;

function assertBand(value: number, [min, max]: readonly [number, number], label: string) {
	expect(value, label).toBeGreaterThanOrEqual(min);
	expect(value, label).toBeLessThanOrEqual(max);
}

function check({ widthM, reliefM, landSlopeShares, stepHeightsM }: Measurements, label: string) {
	expect(widthM.length, label + ' complete width stations').toBeGreaterThan(0);
	for (const width of widthM) assertBand(width, bands.wetWidthM, label + ' wet width (m)');
	assertBand(reliefM, bands.smoothedCoreReliefM, label + ' core relief (m)');
	assertBand(landSlopeShares[0], bands.gentleLandShare, label + ' gently sloped land share');
	expect(stepHeightsM.length, label + ' step candidates').toBeGreaterThanOrEqual(
		bands.minimumStepCandidates
	);
	assertBand(percentile(stepHeightsM, 0.5), bands.medianStepHeightM, label + ' step p50 (m)');
	expect(percentile(stepHeightsM, 0.9), label + ' step p90 (m)').toBeLessThanOrEqual(
		bands.maximumStepHeightP90M
	);
}

function percentile(values: readonly number[], fraction: number): number {
	const sorted = values.toSorted((a, b) => a - b);
	const rank = (sorted.length - 1) * fraction;
	const lo = Math.floor(rank);
	return sorted[lo] + (sorted[Math.ceil(rank)] - sorted[lo]) * (rank - lo);
}

function stats(
	width: number,
	relief: number,
	gentle: number,
	step: readonly number[],
	stepCount?: number
): string {
	return `| ${width.toFixed(2)} | ${relief.toFixed(2)} | ${(100 * gentle).toFixed(2)} | ${step.map((v) => v.toFixed(2)).join(' / ')} | ${stepCount ?? '—'} |`;
}

test('measures and gates the ground of all 38 frozen seeds', () => {
	const rows = [...VALLEY_X1_SEEDS, ...VALLEY_HOLDOUT_SEEDS].map((seed) => ({
		seed,
		...measure(generateValley({ seed }))
	}));
	console.log(
		[
			'| Surface | Wet width p50 (m) | Core relief (m) | Gentle land (%) | Steps p10 / p50 / p90 (m) | Candidates |',
			'| --- | ---: | ---: | ---: | ---: | ---: |',
			...VALLEY_REFERENCES.map((row) =>
				row.surface === 'dtm'
					? `| ${row.city} DTM ${stats(row.wetWidthMedianM, row.smoothedCoreReliefM, row.landSlopeBelow2PercentShare, row.stepHeightP10P50P90M)}`
					: `| ${row.city} DSM | ${row.wetWidthMedianM} | — | — | — | — |`
			),
			...rows.map(
				({ seed, widthM, reliefM, landSlopeShares, stepHeightsM }) =>
					`| ${seed} ${stats(
						percentile(widthM, 0.5),
						reliefM,
						landSlopeShares[0],
						[0.1, 0.5, 0.9].map((q) => percentile(stepHeightsM, q)),
						stepHeightsM.length
					)}`
			)
		].join('\n')
	);
	for (const row of rows) check(row, String(row.seed));
}, 120_000);

function rotateCourse(valley: Valley, radians: number): Valley {
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const { course } = valley;
	const xy = new Float64Array(course.xy.length);
	for (let i = 0; i < xy.length; i += 2) {
		const x = course.xy[i];
		const y = course.xy[i + 1];
		xy[i] = x * cos - y * sin;
		xy[i + 1] = x * sin + y * cos;
	}
	return { ...valley, course: { ...course, xy } };
}

function fixed([lo, hi]: readonly [number, number], fraction: number): [number, number] {
	const value = lo + (hi - lo) * fraction;
	return [value, value];
}

test('gates the default shape box at endpoints and midpoints and the protocol bearings', () => {
	const defaults = DEFAULT_VALLEY_PARAMETERS;
	const seed = VALLEY_X1_SEEDS[0];
	const straight = generateValley({ seed, parameters: { headingAmplitude: [0, 0] } }).course.xy;
	const bearing = Math.atan2(straight[3] - straight[1], straight[2] - straight[0]);
	const rows = [];
	for (const width of protocol.boxFractions) {
		for (const phase of protocol.boxFractions) {
			for (const curvature of protocol.boxFractions) {
				const valley = generateValley({
					seed,
					parameters: {
						bankfullWidthM: fixed(defaults.bankfullWidthM, width),
						phaseOffset: fixed(defaults.phaseOffset, phase),
						headingAmplitude: fixed(defaults.headingAmplitude, curvature),
						wavelengthToWidth: fixed(defaults.wavelengthToWidth, curvature)
					}
				});
				for (const degrees of protocol.cornerBearingsDeg) {
					const fieldBearing = (degrees * Math.PI) / 180;
					const label = `width f=${width}, phase f=${phase}, curvature f=${curvature}, ${degrees}°`;
					rows.push({ label, ...measure(rotateCourse(valley, fieldBearing - bearing)) });
				}
			}
		}
	}
	const range = (values: number[]) =>
		[Math.min(...values), Math.max(...values)].map((v) => v.toFixed(3)).join('–');
	console.log(
		`Box (${rows.length} fields). Wet width ${range(rows.flatMap((row) => row.widthM))} m. Relief ${range(rows.map((row) => row.reliefM))} m. Gentle land ${range(rows.map((row) => row.landSlopeShares[0] * 100))}%. Steps p50 ${range(rows.map((row) => percentile(row.stepHeightsM, 0.5)))} m, p90 ${range(rows.map((row) => percentile(row.stepHeightsM, 0.9)))} m.`
	);
	for (const row of rows) check(row, row.label);
}, 120_000);
