import { expect, test } from 'bun:test';
import { wasserFeld } from './wasser';

test('the seed reproduces the moving field on a rectangular grid', () => {
	const a = wasserFeld(1.6, 0.9);
	const b = wasserFeld(1.6, 0.9);
	const start = a.hoehenM.slice();
	expect(start).not.toEqual(wasserFeld(1.6, 0.9, 84).hoehenM);
	for (let i = 0; i < 25; i++) {
		a.schritt();
		b.schritt();
	}
	expect(a.hoehenM).toEqual(b.hoehenM);
	expect(a.hoehenM).not.toEqual(start);
});

test('a corner disturbance propagates inwards with zero outward flux', () => {
	const a = wasserFeld(0.7, 0.7);
	const b = wasserFeld(0.7, 0.7);
	a.hoehenM[0] += 0.01;
	a.schritt();
	b.schritt();
	const delta = (i: number) => a.hoehenM[i] - b.hoehenM[i];
	const nachbar = (0.01 * 0.65 ** 2) / 2;
	expect(delta(1)).toBeCloseTo(nachbar, 12);
	expect(delta(a.nx)).toBeCloseTo(nachbar, 12);
	expect(delta(0)).toBeCloseTo(0.01 * (1 + Math.exp(-0.15 * a.schrittS)) - 2 * nachbar, 12);
	expect(delta(a.nx - 1)).toBe(0);
	expect(delta(a.nx + 1)).toBe(0);
});

test('a closed tank keeps its mean level and damps after repeated reflections', () => {
	const feld = wasserFeld(1.6, 0.9);
	const mittel = () => feld.hoehenM.reduce((a, b) => a + b, 0) / feld.hoehenM.length;
	const pegel = mittel();
	const spitze = () => feld.hoehenM.reduce((a, b) => Math.max(a, Math.abs(b - pegel)), 0);
	const start = spitze();
	for (let i = 0; i < 1800; i++) feld.schritt();
	expect(mittel()).toBeCloseTo(pegel, 10);
	expect(spitze()).toBeLessThan(start * 0.35);
});

test('the solver rejects undersized or non-finite spans and caps its grid', () => {
	for (const m of [0.01, NaN, Infinity]) expect(() => wasserFeld(1, m)).toThrow(RangeError);
	expect(wasserFeld(1000, 0.7).nx).toBe(181);
});

test('returning trains keep the upstream corner rippled during replay', () => {
	const breiteM = 4.8;
	const tiefeM = 3.3;
	const feld = wasserFeld(breiteM, tiefeM);
	const dx = breiteM / (feld.nx - 1);
	const dz = tiefeM / (feld.nz - 1);
	for (let zeitS = 0; zeitS < 1.7; zeitS += feld.schrittS) feld.schritt();
	const w = Math.floor(feld.nx * 0.2) - 1;
	const d = Math.floor(feld.nz * 0.2) - 1;
	let steigungQuadrat = 0;
	for (let z = 0; z < d; z++) {
		for (let x = 0; x < w; x++) {
			const i = z * feld.nx + x;
			const h = feld.hoehenM[i];
			steigungQuadrat +=
				((feld.hoehenM[i + 1] - h) / dx) ** 2 + ((feld.hoehenM[i + feld.nx] - h) / dz) ** 2;
		}
	}
	expect(Math.sqrt(steigungQuadrat / (w * d))).toBeGreaterThan(0.02);
});
