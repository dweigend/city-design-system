import { expect, test } from 'bun:test';
import {
	LARGE_LOWLAND_MEASUREMENT_BANDS as bands,
	VALLEY_FORM_BANDS as form,
	VALLEY_HOLDOUT_SEEDS,
	VALLEY_PICTURE_SEEDS,
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
	const measured = measureRiverSurface(field, valley.course.xy, protocol);
	const left = percentile(
		measured.bankPairsM.map(([width]) => width),
		0.5
	);
	const right = percentile(
		measured.bankPairsM.map(([, width]) => width),
		0.5
	);
	return {
		...measured,
		floodplainRatio: Math.max(left, right) / Math.min(left, right),
		stepSpreadM: percentile(measured.stepHeightsM, 0.9) - percentile(measured.stepHeightsM, 0.1)
	};
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

function checkForm(row: Measurements, label: string) {
	expect(row.bankPairsM.length, label + ' complete bank pairs').toBeGreaterThanOrEqual(
		form.minimumCompleteBankPairs
	);
	expect(row.floodplainRatio, label + ' floodplain width ratio').toBeGreaterThanOrEqual(
		form.minimumFloodplainWidthRatio
	);
	expect(row.stepSpreadM, label + ' step p90 − p10').toBeGreaterThanOrEqual(
		form.minimumStepSpreadM
	);
}

function reportForm(label: string, rows: Measurements[]) {
	const range = (values: number[]) =>
		`${Math.min(...values).toFixed(3)}–${Math.max(...values).toFixed(3)}`;
	console.log(
		`${label}: bank pairs ${range(rows.map((r) => r.bankPairsM.length))}, floodplain ratio ${range(rows.map((r) => r.floodplainRatio))}, step spread ${range(rows.map((r) => r.stepSpreadM))} m.`
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
	reportForm('Seed form', rows);
	for (const row of rows) {
		check(row, String(row.seed));
		checkForm(row, String(row.seed));
	}
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
	reportForm('Box form', rows);
	for (const row of rows) {
		check(row, row.label);
		checkForm(row, row.label);
	}
}, 120_000);

function maskDifference(a: Uint8Array, b: Uint8Array, level: number) {
	let union = 0;
	let difference = 0;
	for (let i = 0; i < a.length; i++) {
		const aMatches = a[i] === level;
		const bMatches = b[i] === level;
		union += Number(aMatches || bMatches);
		difference += Number(aMatches !== bMatches);
	}
	return difference / union;
}

test('distinguishes every pair of pictured valleys in a common frame', () => {
	const grids = VALLEY_PICTURE_SEEDS.map((seed) => {
		const valley = generateValley({ seed });
		return sampleValley(rotateCourse(valley, -Math.PI / 2 - valley.course.meanBearingRad), {
			windowM: protocol.localWindowM,
			spacingM: protocol.fieldSpacingM
		}).floor;
	});
	const pairs = [
		[0, 1],
		[0, 2],
		[1, 2]
	] as const;
	for (const [i, j] of pairs) {
		const label = `${VALLEY_PICTURE_SEEDS[i]} / ${VALLEY_PICTURE_SEEDS[j]}`;
		const wet = maskDifference(grids[i], grids[j], 0);
		const floodplain = maskDifference(grids[i], grids[j], 1);
		console.log(
			`${label}: wet difference ${wet.toFixed(3)}, floodplain difference ${floodplain.toFixed(3)}`
		);
		expect(wet, label).toBeGreaterThanOrEqual(form.minimumWetMaskDifference);
		expect(floodplain, label).toBeGreaterThanOrEqual(form.minimumFloodplainMaskDifference);
	}
});
