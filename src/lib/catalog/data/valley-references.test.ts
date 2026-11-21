import { expect, test } from 'bun:test';
import { nextSeed } from '../core/random';
import {
	VALLEY_HOLDOUT_ROOT,
	VALLEY_HOLDOUT_SEEDS,
	VALLEY_MEASUREMENT_PROTOCOL,
	VALLEY_PICTURE_SEEDS,
	VALLEY_REFERENCES,
	VALLEY_X1_SEEDS
} from './valley-references';

test('keeps the four city rows and restricts relief, slope and steps to bare earth', () => {
	expect(VALLEY_REFERENCES.map(({ city }) => city)).toEqual([
		'Cologne',
		'Bonn',
		'Basel',
		'Regensburg'
	]);
	for (const row of VALLEY_REFERENCES) {
		expect('smoothedCoreReliefM' in row).toBe(row.surface === 'dtm');
		expect('landSlopeBelow2PercentShare' in row).toBe(row.surface === 'dtm');
		expect('stepHeightP10P50P90M' in row).toBe(row.surface === 'dtm');
	}
});

test('keeps the centered measurement scales and vector spacing', () => {
	expect(VALLEY_MEASUREMENT_PROTOCOL).toMatchObject({
		localWindowM: 2000,
		regionalWindowM: 8000,
		courseSpacingM: 6.25,
		borderHits: 2
	});
});

test('keeps the picture seeds inside the six comparison seeds', () => {
	expect(VALLEY_PICTURE_SEEDS).toEqual([1201, 1301, 1409]);
	expect(VALLEY_X1_SEEDS).toEqual([1201, 1301, 1409, 1511, 1601, 1709]);
});

test('fixes 32 unique holdouts from the declared nextSeed chain', () => {
	expect(VALLEY_HOLDOUT_SEEDS).toHaveLength(32);
	expect(new Set([...VALLEY_X1_SEEDS, ...VALLEY_HOLDOUT_SEEDS]).size).toBe(38);
	let seed: number = VALLEY_HOLDOUT_ROOT;
	for (const expected of VALLEY_HOLDOUT_SEEDS) {
		seed = nextSeed(seed);
		expect(seed).toBe(expected);
	}
});
