import { expect, test } from 'bun:test';
import { Valley } from '../../domain/valley';
import {
	clipPolylineToSquare,
	measureRiver,
	measureRiverSurface
} from '../../domain/river-metrics';
import {
	LARGE_LOWLAND_MEASUREMENT_BANDS as bands,
	VALLEY_FORM_BANDS as form,
	VALLEY_HOLDOUT_SEEDS,
	VALLEY_MEASUREMENT_PROTOCOL as protocol,
	VALLEY_REFERENCES,
	VALLEY_X1_SEEDS
} from './index';

const seeds = [...VALLEY_X1_SEEDS, ...VALLEY_HOLDOUT_SEEDS];
const defaults = seeds.map((seed) => Valley.create({ seed }));

function percentile(values: readonly number[], fraction: number): number {
	const sorted = values.toSorted((a, b) => a - b);
	const rank = (sorted.length - 1) * fraction;
	const low = Math.floor(rank);
	return sorted[low] + (sorted[Math.ceil(rank)] - sorted[low]) * (rank - low);
}

function reach(valley: Valley, window: number) {
	const { course } = valley;
	const clipped = clipPolylineToSquare(course.xy, window);
	if (!clipped || clipped.borderHits !== protocol.borderHits) {
		throw new Error(`Seed ${valley.seed}, ${window} m: ${clipped?.borderHits} border hits`);
	}
	const half = window / 2;
	const { xy } = clipped;
	expect(Math.max(Math.abs(xy[0]), Math.abs(xy[1])), `Seed ${valley.seed} start`).toBe(half);
	expect(
		Math.max(Math.abs(xy[xy.length - 2]), Math.abs(xy[xy.length - 1])),
		`Seed ${valley.seed} end`
	).toBe(half);
	return measureRiver({ ...course, xy }, course.xy);
}

function row(valley: Valley) {
	const { course, grid, seed } = valley;
	const { widthM, reliefM, landSlopeShares, stepHeightsM, bankPairsM, dryBankWidthsM } =
		measureRiverSurface(
			{
				windowM: protocol.localWindowM,
				spacingM: protocol.fieldSpacingM,
				bedMm: grid.heights.map((value) => Math.round(value * 1000)),
				meanWaterMm: grid.waterHeights.map((value) => Math.round(value * 1000)),
				floor: grid.bands
			},
			course.xy,
			protocol
		);
	const banks = [0, 1].map((side) =>
		percentile(
			bankPairsM.map((pair) => pair[side]),
			0.5
		)
	);
	const local = reach(valley, protocol.localWindowM);
	const regional = reach(valley, protocol.regionalWindowM);
	return {
		seed,
		sinuosity2km: local.sinuosity,
		sinuosity8km: regional.sinuosity,
		regionalIncrease: regional.sinuosity - local.sinuosity,
		wavelengthRatio: regional.wavelengthToWidth ?? NaN,
		minimumWetWidth: Math.min(course.wetWidth, ...widthM),
		maximumWetWidth: Math.max(course.wetWidth, ...widthM),
		widthStations: widthM.length,
		reliefM,
		gentleLandShare: landSlopeShares[0],
		stepCandidates: stepHeightsM.length,
		medianStepHeightM: percentile(stepHeightsM, 0.5),
		stepHeightP90: percentile(stepHeightsM, 0.9),
		stepSpread: percentile(stepHeightsM, 0.9) - percentile(stepHeightsM, 0.1),
		completeBankPairs: bankPairsM.length,
		minimumDryWidth: Math.min(...dryBankWidthsM),
		floodplainRatio: Math.max(...banks) / Math.min(...banks)
	};
}

type Row = ReturnType<typeof row>;
const limits = {
	sinuosity2km: bands.sinuosity2km,
	sinuosity8km: bands.sinuosity8km,
	regionalIncrease: [Number.MIN_VALUE, Infinity],
	minimumWetWidth: bands.wetWidthM,
	maximumWetWidth: bands.wetWidthM,
	widthStations: [1, Infinity],
	reliefM: bands.smoothedCoreReliefM,
	gentleLandShare: bands.gentleLandShare,
	stepCandidates: [bands.minimumStepCandidates, Infinity],
	medianStepHeightM: bands.medianStepHeightM,
	stepHeightP90: [-Infinity, bands.maximumStepHeightP90M],
	stepSpread: [form.minimumStepSpreadM, Infinity],
	completeBankPairs: [form.minimumCompleteBankPairs, Infinity],
	minimumDryWidth: [form.minimumDryBankWidthM, Infinity],
	floodplainRatio: [form.minimumFloodplainWidthRatio, Infinity]
} satisfies Partial<Record<keyof Row, readonly [number, number]>>;

test('the default valley supplies the registered north-first measurement raster', () => {
	const { grid } = Valley.create({ seed: 1201 });
	expect(grid.cellSize).toBe(12.5);
	expect(grid.heights).toHaveLength(161 * 161);
	expect(grid.waterHeights).toHaveLength(161 * 161);
});

test('checks the vector, cross-section and ground limits on all 38 registered seeds', () => {
	expect(new Set(seeds).size).toBe(38);
	const rows = defaults.map(row);
	for (const reference of VALLEY_REFERENCES) {
		console.log(
			`${reference.city}: S2 ${reference.sinuosity2km}, S8 ${reference.sinuosity8km}, median wet width ${reference.wetWidthMedianM} m`
		);
	}
	const failures = [];
	for (const [name, [min, max]] of Object.entries(limits)) {
		const values = rows.map((r) => r[name as keyof Row]);
		console.log(
			`${name}: ${Math.min(...values).toFixed(4)}–${Math.max(...values).toFixed(4)} [${min}, ${max}]`
		);
		for (const [index, value] of values.entries()) {
			if (!Number.isFinite(value) || value < min || value > max) {
				const delta = value < min ? value - min : value - max;
				failures.push(
					`Seed ${rows[index].seed} ${name}: ${value}, limit [${min}, ${max}], delta ${delta}`
				);
			}
		}
	}
	const regional = rows.map((r) => r.sinuosity8km);
	const median = percentile(regional, 0.5);
	const wavelength = rows.map((r) => r.wavelengthRatio);
	for (const { seed, wavelengthRatio } of rows) {
		expect(wavelengthRatio, `Seed ${seed} wavelength / bankfull width`).toBeGreaterThanOrEqual(
			bands.wavelengthToBankfullWidth[0]
		);
		expect(wavelengthRatio, `Seed ${seed} wavelength / bankfull width`).toBeLessThanOrEqual(
			bands.wavelengthToBankfullWidth[1]
		);
	}
	console.log(
		`Median S2 ${percentile(
			rows.map((r) => r.sinuosity2km),
			0.5
		)}, median S8 ${median}, default seed S8 ${regional[0]}, measured wavelength / bankfull width ${Math.min(...wavelength)}–${Math.max(...wavelength)}`
	);
	expect(median).toBeGreaterThanOrEqual(bands.medianSinuosity8km[0]);
	expect(median).toBeLessThanOrEqual(bands.medianSinuosity8km[1]);
	expect(failures).toEqual([]);
}, 60_000);

test('increases mean regional sinuosity across the same seeds as Meander increases', () => {
	const settings = [1.04, 1.1, 1.15, 1.21, 1.28];
	let previous = 1;
	for (const sinuosity of settings) {
		const valleys =
			sinuosity === 1.15
				? defaults
				: seeds.map((seed) => Valley.create({ seed, parameters: { sinuosity } }));
		const ratios = valleys.map((valley) => reach(valley, protocol.regionalWindowM).sinuosity);
		const mean = ratios.reduce((sum, value) => sum + value, 0) / seeds.length;
		console.log(`Meander ${sinuosity.toFixed(2)}: mean S8 ${mean.toFixed(5)}`);
		expect(mean).toBeGreaterThan(previous);
		previous = mean;
	}
}, 60_000);
