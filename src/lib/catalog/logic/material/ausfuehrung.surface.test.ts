import { expect, test } from 'bun:test';
import { flowToken } from '../../data/focus';
import { familien } from '../../data/materialSeite';
import { ausfuehrungenVon, oberflaechenWerte } from './ausfuehrung';
import { rezept, voreinstellung } from './rezept';

test('all nine families have unique deterministic native-first finish choices', () => {
	const ids = familien.flatMap((f) => ausfuehrungenVon(f.id).map((a) => a.id));
	expect(new Set(ids).size).toBe(ids.length);
	expect(familien).toHaveLength(9);
	for (const f of familien) {
		const choices = ausfuehrungenVon(f.id);
		expect(choices.length).toBeGreaterThan(0);
		expect(oberflaechenWerte(rezept(f.id)).id).toBe(choices[0].id);
		expect(ausfuehrungenVon(f.id)).toEqual(choices);
	}
	expect(ausfuehrungenVon('kunststoff')[0].id).toBe('acryl-matt');
});

test('clear glass, water and pale stock isolate all flow pigments', () => {
	for (const family of ['glas', 'wasser', 'bestand'] as const) {
		const native = oberflaechenWerte(rezept(family, voreinstellung(family, 'neutral')));
		for (const flow of ['people', 'water', 'energy', 'food', 'material'] as const)
			expect(oberflaechenWerte(rezept(family, voreinstellung(family, flow)))).toEqual(native);
	}
	expect(oberflaechenWerte(rezept('bestand')).grundton).toBe('#eeece6');
});

test('native response separates mineral, metal, glaze, frost and clear glass', () => {
	expect(oberflaechenWerte(rezept('beton')).rauheit).toBeGreaterThan(0.7);
	expect(oberflaechenWerte(rezept('keramik')).rauheit).toBeLessThan(0.3);
	expect(oberflaechenWerte(rezept('metall'), 'metall-gebuerstet').metall).toBe(1);
	expect(oberflaechenWerte(rezept('kunststoff')).rauheit).toBeGreaterThan(0.3);
	expect(oberflaechenWerte(rezept('glas')).transmission).toBeGreaterThan(0.9);
});

test('roughness, gloss and opacity controls change the physical surface without mutating recipes', () => {
	const w = voreinstellung('beton', 'neutral');
	const r = rezept('beton', w);
	const snapshot = structuredClone(r);
	const native = oberflaechenWerte(r);
	expect(oberflaechenWerte(rezept('beton', { ...w, rauheit: 'glatt' })).rauheit).toBeLessThan(
		native.rauheit
	);
	expect(oberflaechenWerte(rezept('beton', { ...w, glanz: 'glanz' })).rauheit).toBeLessThan(
		native.rauheit
	);
	expect(oberflaechenWerte(rezept('beton', { ...w, deckkraft: 'trace' })).deckkraft).toBeLessThan(
		native.deckkraft
	);
	expect(r).toEqual(snapshot);
});

test('foreign finish falls back to native and legacy recipes retain their flow rules', () => {
	expect(oberflaechenWerte(rezept('holz'), 'beton-terrazzo').id).toBe('holz-natur');
	expect(rezept('metall', voreinstellung('metall', 'people')).farbe.token).toBe(flowToken.people);
	expect(rezept('beton').farbe.papier).toBe(0.4);
});
