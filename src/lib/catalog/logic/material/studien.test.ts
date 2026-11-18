// @ts-expect-error Bun provides this test API at runtime.
import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { familien } from '../../data/materialSeite';
import { form } from './formen';
import { probeSzene, mischSzene } from './studien';
import { voreinstellung } from './rezept';

describe('Physical specimen contract examples', () => {
	test('nine deterministic detached assemblies stay below forty parts', () => {
		for (const { id } of familien) {
			const a = probeSzene(id, voreinstellung(id));
			expect(a).toEqual(probeSzene(id, voreinstellung(id)));
			expect(a.length).toBeLessThan(40);
			expect(a.some((s) => s.rezept.familie === id)).toBe(true);
			expect(new Set(a.map((s) => s.id)).size).toBe(a.length);
			a[0].teil.lage[0] = 999;
			expect(probeSzene(id, voreinstellung(id))[0].teil.lage[0]).not.toBe(999);
		}
	});
	test('metal includes true perforation, folds and a hollow tube', () => {
		const profiles = probeSzene('metall', voreinstellung('metall')).map((s) => s.teil.profil?.art);
		expect(profiles).toContain('lochplatte');
		expect(profiles).toContain('faltblech');
		expect(profiles).toContain('rohr');
	});
	test('optical panels share an accessible colorful interior and frame', () => {
		for (const fam of ['glas', 'kunststoff'] as const) {
			const a = probeSzene(fam, voreinstellung(fam));
			expect(a.filter((s) => s.id.includes('interior')).length).toBe(3);
			expect(a.filter((s) => s.id.includes('mullion')).length).toBe(3);
			expect(a.find((s) => s.id.includes('panel'))?.teil.mass[1]).toBeGreaterThan(0.05);
		}
	});
	test('water has a bottom below the surface, membrane has physical seam relief', () => {
		const water = probeSzene('wasser', voreinstellung('wasser'));
		const surface = water.find((s) => s.rezept.familie === 'wasser');
		const bottom = water.find((s) => s.id.includes('bottom'));
		assert(bottom && surface);
		expect(bottom.teil.lage[2] + bottom.teil.mass[2]).toBeLessThan(surface.teil.lage[2]);
		expect(
			probeSzene('membran', voreinstellung('membran')).some((s) => s.teil.profil?.art === 'naht')
		).toBe(true);
	});
	test('support recipes ignore flow, mixed assembly is bounded and legacy forms stay intact', () => {
		for (const { id } of familien) {
			const a = probeSzene(id, voreinstellung(id, 'people')).filter(
				(s) => s.teil.rolle === 'bestand'
			);
			const b = probeSzene(id, voreinstellung(id, 'energy')).filter(
				(s) => s.teil.rolle === 'bestand'
			);
			expect(a).toEqual(b);
		}
		expect(mischSzene()).toEqual(mischSzene());
		expect(mischSzene().length).toBeLessThan(40);
		expect(new Set(mischSzene().map((s) => s.rezept.familie)).size).toBeGreaterThan(5);
		expect(form('box')).toEqual([
			{ art: 'quader', mass: [4, 4, 4], lage: [0, 0, 0], rolle: 'neu' }
		]);
		expect((['box', 'kuppel', 'turm', 'bestand'] as const).map((id) => form(id).length)).toEqual([
			1, 2, 4, 4
		]);
	});
});
