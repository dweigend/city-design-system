// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { klassenAusnutzung, klassenNormalkraft, klassenVerformung } from './statikSkala';

describe('Analysis classes', () => {
	test('axial force stays symmetric, the zero class stays muted', () => {
		expect(klassenNormalkraft[3]).toEqual({ von: -25000, bis: 25000, token: '--ana-null' });
		expect(klassenNormalkraft.map((k) => k.von)).toEqual([
			-Infinity,
			-200000,
			-100000,
			-25000,
			25000,
			100000,
			200000
		]);
	});
	test('utilization stays in 20 % steps, overload is separate', () => {
		expect(klassenAusnutzung.map((k) => k.von)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
		expect(klassenAusnutzung.at(-1)?.token).toBe('--cat-hazard');
	});
	test('deformation has fixed 15 mm boundaries; 52.4 mm falls in the fourth class', () => {
		expect(klassenVerformung.map((k) => k.von)).toEqual([0, 0.015, 0.03, 0.045, 0.06]);
		expect(klassenVerformung.findIndex((k) => 0.0524 >= k.von && 0.0524 < k.bis)).toBe(3);
		expect(klassenVerformung.at(-1)?.bis).toBe(Infinity);
	});
});
