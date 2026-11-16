// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { hochwegBeispiele } from '../../data/stadtHochwege';
import { wegenetz } from '../bibel/wege';
import { hochwegSzene } from './hochwege';

describe('Elevated walkways in the city context', () => {
	test('the same inputs return the same image and change no sample data', () => {
		const vorher = JSON.stringify(hochwegBeispiele);
		for (const b of hochwegBeispiele) {
			expect(hochwegSzene(b, 3.5, 2)).toEqual(hochwegSzene(b, 3.5, 2));
		}
		expect(JSON.stringify(hochwegBeispiele)).toBe(vorher);
	});
	test('step zero shows houses but no paths; half a step halves the first length', () => {
		for (const b of hochwegBeispiele) {
			expect(hochwegSzene(b, 0, 2).kisten.filter((k) => k.id.startsWith('kante:'))).toHaveLength(0);
			const halb = hochwegSzene(b, 0.5, 2);
			const weg = halb.kisten.find((k) => k.id.startsWith('kante:'));
			expect(weg?.s[0]).toBeCloseTo(halb.kanten[0].laenge / 2);
		}
	});
	test('a full step keeps the spanning forest order and adds up to two loops', () => {
		for (const b of hochwegBeispiele) {
			const netz = wegenetz(b.knoten, 2);
			const szene = hochwegSzene(b, 100, 2);
			expect(szene.kanten.map(({ a, b, laenge }) => ({ a, b, laenge }))).toEqual([
				...netz.baum,
				...netz.schleifen
			]);
			expect(szene.kisten.filter((k) => k.id.startsWith('kante:'))).toHaveLength(
				netz.baum.length + netz.schleifen.length
			);
			expect(netz.schleifen.length).toBeGreaterThanOrEqual(1);
			expect(netz.schleifen.length).toBeLessThanOrEqual(2);
		}
		expect(wegenetz(hochwegBeispiele[0].knoten, 0).baum).toHaveLength(7);
	});
	test('paths stay within 13 m, houses and paths have stable targets', () => {
		for (const b of hochwegBeispiele) {
			const szene = hochwegSzene(b, 100, 2);
			for (const n of b.knoten)
				expect(
					szene.kisten.some((k) => k.id === `haus:${n.id}` && k.target === `knoten:${n.id}`)
				).toBe(true);
			for (const e of szene.kanten) {
				expect(e.laenge).toBeLessThanOrEqual(13);
				expect(szene.kisten.some((k) => k.target === e.target)).toBe(true);
			}
			expect(wegenetz(b.knoten).zuLang.length).toBeGreaterThan(0);
			const ziel = szene.kanten[0].target;
			// Highlight as in all city components: signal edge.
			expect(hochwegSzene(b, 100, 2, ziel).kisten.find((k) => k.target === ziel)?.edge).toBe(
				'--signal'
			);
		}
	});
	test('old town: a roof node at 16 m does not connect to the gallery without a port', () => {
		const b = hochwegBeispiele[1];
		const dach = b.knoten.findIndex((n) => n.ebene === 4);
		const szene = hochwegSzene(b, 100, 2);
		expect(szene.kanten.some((e) => e.a === dach || e.b === dach)).toBe(false);
		expect(szene.kisten.some((k) => k.id === `port:${b.knoten[dach].id}`)).toBe(false);
		expect(wegenetz(b.knoten).baum).toHaveLength(b.knoten.length - 2);
	});
});
