// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { describe, expect, test } from 'bun:test';
import { loopSchleier, phaseAt, phaseProgress, totalDuration, type Phase } from './zeitleiste';
import { anker, weiterbauenSzene } from './weiterbauen';
import { fuellung, schwammSzene } from './schwamm';
import { bauteilSzene, paletteSzene, platteSzene } from './bauteile';
import { BESTAND, beam } from './kiste';
import {
	bauteilLoops,
	eingriffe,
	lagen,
	schwammPhasen,
	stufen,
	type LageId
} from '../../data/stadtBausteine';

const phasen: Phase[] = [
	{ id: 'a', durationS: 2 },
	{ id: 'b', durationS: 3 }
];

describe('Timeline', () => {
	test('phase boundaries and repetition', () => {
		expect(phaseAt(phasen, 0)).toEqual({ index: 0, local: 0, timeS: 0 });
		expect(phaseAt(phasen, 2).index).toBe(1);
		expect(phaseAt(phasen, 3.5).local).toBeCloseTo(0.5);
		// 5 s = one run: back at the start; negative time runs backward into the loop.
		expect(phaseAt(phasen, 5)).toEqual(phaseAt(phasen, 0));
		expect(phaseAt(phasen, -1).index).toBe(1);
	});
	test('progress of a phase: 0 before, 1 after', () => {
		expect(phaseProgress(phasen, 1, 'b')).toBe(0);
		expect(phaseProgress(phasen, 3.5, 'b')).toBeCloseTo(0.5);
		expect(phaseProgress(phasen, 3.5, 'a')).toBe(1);
		expect(() => phaseProgress(phasen, 0, 'x')).toThrow();
	});
	test('veil at the seam: first start clear, end and restart covered, middle clear', () => {
		expect(loopSchleier(phasen, 0)).toBe(0);
		expect(loopSchleier(phasen, 2.5)).toBe(0);
		expect(loopSchleier(phasen, 4.99)).toBeGreaterThan(0.95);
		expect(loopSchleier(phasen, 5)).toBe(1);
		expect(loopSchleier(phasen, 5.3)).toBeCloseTo(0.5);
		expect(loopSchleier(phasen, 5.6)).toBe(0);
		// continuous across the seam: no jump between 4.999 s and 5.001 s
		expect(Math.abs(loopSchleier(phasen, 4.999) - loopSchleier(phasen, 5.001))).toBeLessThan(0.01);
	});
});

describe('Building on existing stock', () => {
	const ids = lagen.map((l) => l.value) as LageId[];
	test('same input, same image', () => {
		for (const id of ids)
			expect(weiterbauenSzene(id, 2, 1, 7.25)).toEqual(weiterbauenSzene(id, 2, 1, 7.25));
	});
	test('retain shows only existing stock, ground and people', () => {
		for (const id of ids)
			for (const k of weiterbauenSzene(id, 0, 1, 3)) {
				const erlaubt =
					k.fill === BESTAND.fill ||
					k.fill.startsWith('--paper') ||
					k.fill === '--ink-3' ||
					k.id.startsWith('mensch');
				expect(erlaubt).toBe(true);
			}
	});
	test('every entry on the right has its counterpart in the image', () => {
		for (const id of ids) {
			const ziele = new Set(weiterbauenSzene(id, 2, 1, 0).map((k) => k.target));
			const punkte = anker(id);
			for (const s of stufen)
				for (const e of eingriffe[id][s.value]) {
					expect(ziele.has(e.target)).toBe(true);
					expect(punkte[e.target]).toBeDefined();
				}
		}
	});
	test('the running step grows, earlier ones stand complete', () => {
		const halb = weiterbauenSzene('zeile', 2, 0.5, 0).find((k) => k.id === 'a0-modul-0');
		const ganz = weiterbauenSzene('zeile', 2, 1, 0).find((k) => k.id === 'a0-modul-0');
		expect(halb?.s[2]).toBeCloseTo((ganz?.s[2] ?? 0) / 2);
		expect(weiterbauenSzene('zeile', 1, 1, 0).some((k) => k.id === 'a0-modul-0')).toBe(false);
	});
});

describe('Sponge city', () => {
	const total = totalDuration(schwammPhasen);
	test('the loop closes: end = start', () => {
		for (const r of ['land', 'stark'] as const) {
			const a = fuellung(0, r),
				b = fuellung(total - 1e-9, r);
			for (const key of Object.keys(a) as (keyof typeof a)[]) expect(b[key]).toBeCloseTo(a[key], 2);
		}
	});
	test('fill levels stay between 0 and 1', () => {
		for (let t = 0; t < total; t += 0.25)
			for (const r of ['land', 'stark'] as const)
				for (const v of Object.values(fuellung(t, r))) {
					expect(v).toBeGreaterThanOrEqual(0);
					expect(v).toBeLessThanOrEqual(1);
				}
	});
	test('only heavy rain reaches the flood swale', () => {
		const ende = schwammPhasen.slice(0, 4).reduce((s, p) => s + p.durationS, 0) - 0.01;
		expect(fuellung(ende, 'land').flut).toBe(0);
		expect(fuellung(ende, 'stark').flut).toBeGreaterThan(0.5);
	});
	test('rain falls only at the start', () => {
		const tropfen = (t: number) => schwammSzene(t, 'land').filter((k) => k.id.startsWith('regen'));
		expect(tropfen(2).length).toBeGreaterThan(0);
		expect(tropfen(total - 1).length).toBe(0);
	});
});

describe('Component passport', () => {
	test('an instance is never in two places: exactly one window frame in every image', () => {
		const loop = bauteilLoops[0];
		const total = totalDuration(loop.phasen);
		for (let t = 0; t < total; t += 0.2)
			expect(bauteilSzene('fenster', t).kisten.filter((k) => k.id === 'f-rahmen').length).toBe(1);
	});
	test('cutting loses no area: panel + offcut = slab (except for the saw kerf)', () => {
		const t = 3.5 + 4; // end of cutting
		const k = platteSzene(t).kisten;
		const flaeche = (id: string) => {
			const x = k.find((q) => q.id === id);
			return x ? x.s[0] * x.s[1] : 0;
		};
		expect(flaeche('paneel') + flaeche('rest')).toBeCloseTo(2.5 * 1.25 - 0.04 * 1.25, 5);
	});
	test('four legs in every image, also while taking apart', () => {
		const total = totalDuration(bauteilLoops[2].phasen);
		for (let t = 0; t < total; t += 0.3)
			expect(paletteSzene(t).kisten.filter((k) => k.id.endsWith('-rohr')).length).toBe(4);
	});
	test('the lifecycle record only grows: entries are sorted by phase', () => {
		for (const l of bauteilLoops) {
			const ab = l.pass.lebenslauf.map((e) => e.ab);
			expect([...ab].sort((a, b) => a - b)).toEqual(ab);
			expect(Math.max(...ab)).toBeLessThan(l.phasen.length);
		}
	});
});

test('a beam lies centered on its line', () => {
	const k = beam('b', [0, 0], [10, 0], 2, 2, 0.4, '--ink');
	expect(k.p).toEqual([0, -1, 2]);
	expect(k.s[0]).toBe(10);
	expect(k.yaw).toBe(0);
});
