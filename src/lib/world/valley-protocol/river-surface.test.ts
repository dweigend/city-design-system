import { expect, test } from 'bun:test';
import { VALLEY_MEASUREMENT_PROTOCOL } from './index';
import { measureRiverSurface } from '../../domain/river-metrics';

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
