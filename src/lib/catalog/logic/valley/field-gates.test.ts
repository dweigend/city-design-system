import { expect, test } from 'bun:test';
import {
	LARGE_LOWLAND_MEASUREMENT_BANDS as bands,
	VALLEY_FORM_BANDS as form,
	VALLEY_HOLDOUT_SEEDS,
	VALLEY_PICTURE_BEARING_RAD,
	VALLEY_PICTURE_SEEDS,
	VALLEY_MEASUREMENT_PROTOCOL as protocol,
	VALLEY_REFERENCES,
	VALLEY_X1_SEEDS
} from '../../data/valley-references';
import { measureRiverSurface } from '../river-metrics';
import {
	DEFAULT_VALLEY_PARAMETERS,
	generateValley,
	sampleValley,
	type Valley,
	type ValleyParameters
} from './index';

const grid = { windowM: protocol.localWindowM, spacingM: protocol.fieldSpacingM };

function measure(valley: Valley, field = sampleValley(valley, grid)) {
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

function check(row: Measurements, label: string) {
	const { widthM, reliefM, landSlopeShares, stepHeightsM } = row;
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
	expect(row.bankPairsM.length, label + ' complete bank pairs').toBeGreaterThanOrEqual(
		form.minimumCompleteBankPairs
	);
	expect(
		Math.min(...row.dryBankWidthsM),
		label + ' dry width on every measured bank'
	).toBeGreaterThanOrEqual(form.minimumDryBankWidthM);
	expect(Number.isFinite(row.floodplainRatio), label + ' finite floodplain ratio').toBe(true);
	expect(row.floodplainRatio, label + ' floodplain width ratio').toBeGreaterThanOrEqual(
		form.minimumFloodplainWidthRatio
	);
	expect(row.stepSpreadM, label + ' step p90 − p10').toBeGreaterThanOrEqual(
		form.minimumStepSpreadM
	);
}

function range(values: number[]) {
	return `${Math.min(...values).toFixed(3)}–${Math.max(...values).toFixed(3)}`;
}

function reportForm(label: string, rows: Measurements[]) {
	console.log(
		`${label}: bank pairs ${range(rows.map((r) => r.bankPairsM.length))}, floodplain ratio ${range(rows.map((r) => r.floodplainRatio))}, step spread ${range(rows.map((r) => r.stepSpreadM))} m, minimum dry width ${Math.min(...rows.map((r) => Math.min(...r.dryBankWidthsM))).toFixed(3)} m.`
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
	console.log(
		`Seed wet width across complete transects: ${range(rows.flatMap((r) => r.widthM))} m.`
	);
	for (const row of rows) check(row, String(row.seed));
}, 300_000);

function fixed([lo, hi]: readonly [number, number], fraction: number): [number, number] {
	const value = lo + (hi - lo) * fraction;
	return [value, value];
}

type BoxCase = { label: string; parameters: Partial<ValleyParameters> };

function combinations(dimensions: readonly (readonly number[])[]): number[][] {
	return dimensions.reduce<number[][]>(
		(rows, options) => rows.flatMap((row) => options.map((option) => [...row, option])),
		[[]]
	);
}

function* shapeCases(): Generator<BoxCase> {
	const defaults = DEFAULT_VALLEY_PARAMETERS;
	const fractions = protocol.boxFractions;
	const placements = [0, 0.25, 0.5, 0.75, 1];
	for (const [width, phase, curvature, placement, ground] of combinations([
		fractions,
		fractions,
		fractions,
		placements,
		fractions
	])) {
		for (const openBank of ['left', 'right'] as const) {
			yield {
				label: `width ${width}, phase ${phase}, curvature ${curvature}, placement ${placement}, ground ${ground}, open ${openBank}`,
				parameters: {
					bankfullWidthM: fixed(defaults.bankfullWidthM, width),
					phaseOffset: fixed(defaults.phaseOffset, phase),
					headingAmplitude: fixed(defaults.headingAmplitude, curvature),
					wavelengthToWidth: fixed(defaults.wavelengthToWidth, curvature),
					windowPhaseOffset: fixed(defaults.windowPhaseOffset, placement),
					groundVariation: fixed(defaults.groundVariation, ground),
					openBank
				}
			};
		}
	}
}

function* layoutCases(): Generator<BoxCase> {
	const defaults = DEFAULT_VALLEY_PARAMETERS;
	const ends = [0, 1];
	const dimensions = [[0.25, 0.75], protocol.boxFractions, ends, ends, ends];
	for (const [placement, across, ground, height, tilt] of combinations(dimensions)) {
		for (const openBank of ['left', 'right'] as const) {
			yield {
				label: `layout phase ${placement}, open ${openBank}, across ${across}, ground ${ground}, height ${height}, tilt ${tilt}`,
				parameters: {
					bankfullWidthM: fixed(defaults.bankfullWidthM, 1),
					windowPhaseOffset: fixed(defaults.windowPhaseOffset, placement),
					windowAcross: fixed(defaults.windowAcross, across),
					groundVariation: fixed(defaults.groundVariation, ground),
					groundHeightVariation: fixed(defaults.groundHeightVariation, height),
					axisTiltRad: fixed(defaults.axisTiltRad, tilt),
					openBank
				}
			};
		}
	}
}

test('gates the default shape box at endpoints and midpoints and the protocol bearings', () => {
	const seed = VALLEY_X1_SEEDS[0];
	const rows = [];
	for (const { label, parameters } of [...shapeCases(), ...layoutCases()]) {
		for (const degrees of protocol.cornerBearingsDeg) {
			const bearingRad = (degrees * Math.PI) / 180;
			try {
				rows.push({
					label: `${label}, ${degrees}°`,
					...measure(generateValley({ seed, parameters, bearingRad }))
				});
			} catch (error) {
				throw Error(`${label}, ${degrees}°`, { cause: error });
			}
		}
	}
	console.log(
		`Box (${rows.length} fields). Wet width ${range(rows.flatMap((row) => row.widthM))} m. Relief ${range(rows.map((row) => row.reliefM))} m. Gentle land ${range(rows.map((row) => row.landSlopeShares[0] * 100))}%. Steps p50 ${range(rows.map((row) => percentile(row.stepHeightsM, 0.5)))} m, p90 ${range(rows.map((row) => percentile(row.stepHeightsM, 0.9)))} m.`
	);
	reportForm('Box form', rows);
	for (const row of rows) check(row, row.label);
}, 300_000);

test('applies the field gates in the actual picture frames', () => {
	for (const seed of VALLEY_PICTURE_SEEDS) {
		const valley = generateValley({ seed, bearingRad: VALLEY_PICTURE_BEARING_RAD });
		check(measure(valley), `Study seed ${seed}`);
	}
});
