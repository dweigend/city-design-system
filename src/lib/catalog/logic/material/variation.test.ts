// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { materialVariation, musterVersatzM, variationFaehig, variationVorgabe } from './variation';

test('native preserves the authored origin and the authored noise amplitude', () => {
	expect(materialVariation()).toEqual(variationVorgabe);
	expect(musterVersatzM(0)).toEqual([0, 0, 0]);
});

test('the boundary clamps finite seeds, rounds fractions and restores defaults for invalid inputs', () => {
	expect(materialVariation('strong', 9.9)).toEqual({ noise: 'strong', seed: 10 });
	expect(materialVariation('quiet', -7)).toEqual({ noise: 'quiet', seed: 0 });
	expect(materialVariation('native', Infinity)).toEqual(variationVorgabe);
	expect(materialVariation('unknown', 90000)).toEqual({ noise: 'native', seed: 65535 });
});

test('each seed locates a detached, deterministic sample in meters', () => {
	const a = musterVersatzM(17);
	expect(a).toEqual(musterVersatzM(17));
	expect(a).not.toBe(musterVersatzM(17));
	expect(a).not.toEqual(musterVersatzM(18));
	expect(a.every((axis) => Math.abs(axis) < 9)).toBe(true);
});

test('designed grids, fluid, mirror and neutral stock keep authored patterns', () => {
	expect(variationFaehig('beton-spritzer')).toBe(true);
	expect(variationFaehig('holz-aufrecht')).toBe(true);
	for (const id of [
		'glas-klar',
		'glas-photovoltaik',
		'metall-messing',
		'wasser-ruhig',
		'bestand-matt'
	] as const)
		expect(variationFaehig(id)).toBe(false);
});
