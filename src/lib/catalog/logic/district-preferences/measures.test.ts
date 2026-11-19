import { expect, test } from 'bun:test';
import { access, electricity, harvest, mix, section } from './measures';

const path = (size: number) =>
	Array.from({ length: size }, (_, i) => [i - 1, i + 1].filter((v) => v >= 0 && v < size));

test('moving one market across 20 cells halves the mean trip approximately', () => {
	expect(access(path(20), [0], 20)).toEqual({ cappedMean: 9.5, covered: 20, unreachable: 0 });
	expect(access(path(20), [9], 20).cappedMean).toBe(5);
	expect(access(path(20), [9], 5).covered).toBe(11);
	expect(access(path(20), [0], 5).covered).toBe(6);
});

test('a one-way park entrance serves only residents with a route to it', () => {
	const paths = [[1], [], [1], [2]];
	expect(access(paths, [0], 2)).toEqual({ cappedMean: 1.5, covered: 1, unreachable: 3 });
	expect(access(paths, [1], 2)).toEqual({ cappedMean: 1, covered: 4, unreachable: 0 });
});

test('a workshop conversion changes mix while its stepped parapet shades a receptor', () => {
	expect(mix([12, 0])).toBe(0);
	expect(mix([6, 6])).toBe(1);
	const sun = [Math.PI / 6, Math.PI / 3];
	expect(section(4, 8, sun)).toEqual({ ratio: 0.5, litSlots: 2 });
	expect(section(8, 8, sun)).toEqual({ ratio: 1, litSlots: 1 });
});

test('shifting a batch load uses the same 12 kWh of solar more fully', () => {
	const solar = [0, 12, 0];
	expect(electricity([5, 8, 5], solar)).toEqual({ deficit: 10, autonomy: 8 / 18 });
	expect(electricity([3, 12, 3], solar)).toEqual({ deficit: 6, autonomy: 12 / 18 });
});

test('a fully recycled nutrient supply can still leave half the food target unmet', () => {
	expect(harvest(100, 0.02, 1, 0)).toEqual({ edibleKg: 50, localN: 1, closure: 1 });
	expect(harvest(100, 0.02, 1, 1)).toEqual({ edibleKg: 100, localN: 1, closure: 0.5 });
});

import { publishPreferences } from './index';
import { defineRules } from '../../core/neighbourhood';

test('a snapshot freezes readings and profile output; compilation preserves excluded forms', () => {
	const evidence = ['walk/time'];
	const inputs = {
		walk: [[[1], []], [1], 2],
		resource: [[2], [1]],
		shade: [4, 8, [Math.PI / 6]]
	} satisfies Parameters<typeof publishPreferences>[1] extends ReadonlyMap<string, infer R>
		? R
		: never;
	const published = publishPreferences('s', new Map([['d', inputs]]), {
		revision: 'p',
		translate: (_id, readings) => ({
			formMultipliers: { market: 1 + readings.walk.cappedMean },
			evidenceRefs: { market: evidence }
		})
	});
	evidence.push('later');
	expect(published.preferences.d.evidenceRefs?.market).toEqual(['walk/time']);
	expect(Object.isFrozen(published.preferences.d.formMultipliers)).toBe(true);
	const pack = defineRules({
		contacts: { market: ['hall', 'market'], hall: ['hall', 'market'] },
		city: { market: 0 },
		revision: published,
		preferenceSnapshot: published
	});
	const cell = { id: 'a', neighbors: [null, null, null], form: 'hall', district: 'd' };
	expect(pack.explain('a', new Map([['a', cell]]), 7)).toMatchObject({
		target: 'hall',
		preferenceStatus: 'current'
	});
});
