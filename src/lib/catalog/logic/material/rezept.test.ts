import { describe, expect, test } from 'bun:test';
import { familien, rezeptPhasen } from '../../data/materialSeite';
import { flowToken } from '../../data/focus';
import {
	alsGeist,
	bisKnoten,
	deckung,
	detailstufe,
	knotenFolge,
	rezept,
	voreinstellung
} from './rezept';
import { tslQuelle } from './tslQuelle';
import { farbeSzene } from './formen';

describe('Material recipe: examples', () => {
	test('existing stock and glass stay without color for every flow', () => {
		for (const s of ['people', 'water', 'energy', 'food', 'material'] as const) {
			expect(rezept('bestand', voreinstellung('bestand', s)).farbe.token).toBe('--paper');
			expect(rezept('glas', voreinstellung('glas', s)).farbe.token).toBe('--paper');
		}
	});
	test('metal carries the flow color fully, concrete muted, water always the water flow', () => {
		const m = rezept('metall', voreinstellung('metall', 'energy'));
		expect(m.farbe).toEqual({ token: flowToken.energy, papier: 0, tint: { ink: 0.09 } });
		expect(rezept('beton', voreinstellung('beton', 'food')).farbe.papier).toBe(0.4);
		expect(rezept('wasser', voreinstellung('wasser', 'people')).farbe.token).toBe('--cat-health');
	});
	test('kit: one more node per step, step 6 is the whole recipe', () => {
		const r = rezept('beton');
		const eins = bisKnoten(r, 1);
		expect(eins.farbe.token).toBe('--paper');
		expect([eins.rauschen, eins.fugen, eins.kante]).toEqual([null, null, null]);
		expect(eins.haut.deckkraft).toBe(1);
		expect(bisKnoten(r, 3).rauschen).toEqual(r.rauschen);
		expect(bisKnoten(r, 3).fugen).toBeNull();
		expect(bisKnoten(r, 6)).toEqual(r);
		expect(rezeptPhasen.map((p) => p.id)).toEqual(knotenFolge);
	});
	test('coverage: solid covers fully, frosted acrylic mixes in the blurred background', () => {
		expect(deckung(rezept('metall').haut)).toEqual({ opacity: 1, hinten: 0 });
		// Hull 30 %, soft diffusion 55 %: 0.3 + 0.7 · 0.55 = 0.685 covers; 0.385 of it blurred.
		expect(deckung(rezept('kunststoff').haut)).toEqual({ opacity: 0.685, hinten: 0.562 });
	});
	test('detail levels shorten the recipe, the ghost reduces the opacity', () => {
		const r = rezept('holz');
		expect(detailstufe(r, 'mittel').rauschen).toBeNull();
		expect(detailstufe(r, 'fern').haut.glanz).toBe(0);
		expect(detailstufe(r, 'linie').farbe.token).toBe('--paper');
		expect(alsGeist(rezept('bestand')).haut.deckkraft).toBe(0.3);
	});
});

describe('Material recipe: invariants', () => {
	test('TSL source: one line per node, with the values of the recipe', () => {
		const zeilen = tslQuelle(rezept('beton'));
		expect(zeilen.map((z) => z.knoten)).toEqual(knotenFolge);
		expect(zeilen[3].code).toContain('positionWorld.y.div(1.25)');
		// Color with a hint of ink, skin with a gloss rim: as in the shader.
		const metall = tslQuelle(rezept('metall', voreinstellung('metall', 'people')));
		expect(metall[1].code).toContain('tinte, 0.09');
		const keramik = tslQuelle(rezept('keramik'));
		expect(keramik[5].code).toContain('fresnel.smoothstep(0.8, 0.86)');
	});
	test('scenes are pure: same input, same result', () => {
		expect(farbeSzene('haus', 0.5)).toEqual(farbeSzene('haus', 0.5));
	});
	test('every family has a recipe within range', () => {
		for (const f of familien) {
			const r = rezept(f.id);
			expect(r.farbe.papier).toBeGreaterThanOrEqual(0);
			expect(r.farbe.papier).toBeLessThanOrEqual(1);
			expect(r.haut.deckkraft).toBeGreaterThan(0);
			expect(r.haut.deckkraft).toBeLessThanOrEqual(1);
		}
	});
});
