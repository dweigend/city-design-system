/**
 * Teaching version "Corner modules / dual grid" in 2D: occupancy on the corners of a grid,
 * modules on the cells. Every cell reads four corners (4 bits, 16 masks, 6 classes under rotation).
 */
import { random } from '../parametrik/random';
import type { Punkt } from './netz';

export type EckOptionen = { saat: number; n?: number; dichte?: number; verzerrung?: number };
export type EckZelle = {
	id: string;
	ecken: [number, number, number, number];
	maske: number;
	klasse: number;
	flaechen: Punkt[][];
	kanten: Punkt[][];
	rahmen: Punkt[];
};
export type EckRaster = { punkte: Punkt[]; belegt: boolean[]; zellen: EckZelle[]; n: number };

/** Canonical masks under four rotations and their names. */
export const eckKlassen = [
	{ maske: 0, name: 'empty' },
	{ maske: 1, name: 'Corner' },
	{ maske: 3, name: 'Edge' },
	{ maske: 5, name: 'Diagonal' },
	{ maske: 7, name: 'Inside corner' },
	{ maske: 15, name: 'full' }
] as const;

export const drehe = (m: number) => ((m << 1) | (m >> 3)) & 15;
export function kanonisch(m: number) {
	let best = m,
		r = m;
	for (let i = 0; i < 3; i++) {
		r = drehe(r);
		best = Math.min(best, r);
	}
	return best;
}
/** Number of rotations that map the canonical mask onto m. */
function drehungen(m: number) {
	let r = kanonisch(m);
	for (let i = 0; i < 4; i++) {
		if (r === m) return i;
		r = drehe(r);
	}
	return 0;
}

/** Burnside: number of mask classes for k corners under four rotations about the vertical axis. */
export function klassenZahl(ecken: 4 | 8) {
	// 2D: cycles of the corner permutation 4, 1, 2, 1 → (16 + 2 + 4 + 2) / 4 = 6.
	// 3D: two rings of four corners each → (256 + 4 + 16 + 4) / 4 = 70.
	return ecken === 4 ? (16 + 2 + 4 + 2) / 4 : (256 + 4 + 16 + 4) / 4;
}

const bogen = (cx: number, cy: number, r: number, a0: number, a1: number, n = 6): Punkt[] =>
	Array.from({ length: n + 1 }, (_, i) => {
		const a = a0 + ((a1 - a0) * i) / n;
		return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
	});

/** Module per canonical mask in (u, v): fill areas and inner facade lines. */
export function modul(m: number): { flaechen: Punkt[][]; kanten: Punkt[][] } {
	const H = Math.PI / 2;
	switch (m) {
		case 1: {
			const a = bogen(0, 0, 0.5, 0, H);
			return { flaechen: [[[0, 0], ...a]], kanten: [a] };
		}
		case 3:
			return {
				flaechen: [
					[
						[0, 0],
						[1, 0],
						[1, 0.5],
						[0, 0.5]
					]
				],
				kanten: [
					[
						[1, 0.5],
						[0, 0.5]
					]
				]
			};
		case 5: {
			const a = bogen(0, 0, 0.5, 0, H),
				b = bogen(1, 1, 0.5, Math.PI, Math.PI + H);
			return {
				flaechen: [
					[[0, 0], ...a],
					[[1, 1], ...b]
				],
				kanten: [a, b]
			};
		}
		case 7: {
			const a = bogen(0, 1, 0.5, 0, -H);
			return {
				flaechen: [[[0, 0], [1, 0], [1, 1], ...a]],
				kanten: [a]
			};
		}
		case 15:
			return {
				flaechen: [
					[
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 1]
					]
				],
				kanten: []
			};
		default:
			return { flaechen: [], kanten: [] };
	}
}

const dreheUV = ([u, v]: Punkt): Punkt => [1 - v, u];
export function bilinear(q: [Punkt, Punkt, Punkt, Punkt], [u, v]: Punkt): Punkt {
	const w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
	return [
		w[0] * q[0][0] + w[1] * q[1][0] + w[2] * q[2][0] + w[3] * q[3][0],
		w[0] * q[0][1] + w[1] * q[1][1] + w[2] * q[2][1] + w[3] * q[3][1]
	];
}

/** Occupancy: smooth hills plus noise, cut to exactly the `dichte` share. */
export function belegung(saat: number, n: number, dichte: number) {
	const rng = random(saat);
	const huegel = Array.from({ length: 3 }, () => [rng() * n, rng() * n, 1.5 + rng() * n * 0.3]);
	const wert = Array.from({ length: (n + 1) * (n + 1) }, (_, k) => {
		const i = k % (n + 1),
			j = Math.floor(k / (n + 1));
		const h = huegel.reduce(
			(s, [x, y, r]) => s + Math.exp(-((i - x) ** 2 + (j - y) ** 2) / (r * r)),
			0
		);
		return 0.7 * h + 0.3 * rng();
	});
	const ordnung = wert.map((w, k) => [w, k]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
	const belegt = new Array(wert.length).fill(false);
	const zahl = Math.round(dichte * wert.length);
	for (let k = 0; k < zahl; k++) belegt[ordnung[k][1]] = true;
	return belegt;
}

/** Corner grid with distorted corners; `umgeschaltet` toggles single corners (click). */
export function eckRaster(
	o: EckOptionen,
	umgeschaltet: ReadonlySet<number> = new Set()
): EckRaster {
	const n = o.n ?? 8,
		v = o.verzerrung ?? 0.3;
	const rng = random(o.saat ^ 0x9e3779b9);
	const phase = rng() * 6.283;
	const punkte: Punkt[] = [];
	for (let j = 0; j <= n; j++)
		for (let i = 0; i <= n; i++) {
			const innen = i > 0 && i < n && j > 0 && j < n;
			const jx = innen ? (rng() - 0.5) * 0.5 : 0,
				jy = innen ? (rng() - 0.5) * 0.5 : 0;
			const wx = innen ? 0.35 * Math.sin(j * 0.8 + phase) : 0,
				wy = innen ? 0.35 * Math.sin(i * 0.7 - phase) : 0;
			punkte.push([i + v * (jx + wx), j + v * (jy + wy)]);
		}
	const roh = belegung(o.saat, n, o.dichte ?? 0.45);
	const belegt = roh.map((b, k) => (umgeschaltet.has(k) ? !b : b));
	const zellen: EckZelle[] = [];
	for (let j = 0; j < n; j++)
		for (let i = 0; i < n; i++) {
			const ecken: [number, number, number, number] = [
				j * (n + 1) + i,
				j * (n + 1) + i + 1,
				(j + 1) * (n + 1) + i + 1,
				(j + 1) * (n + 1) + i
			];
			const maske = ecken.reduce((m, k, b) => m | (belegt[k] ? 1 << b : 0), 0);
			const klasse = kanonisch(maske);
			const q = ecken.map((k) => punkte[k]) as [Punkt, Punkt, Punkt, Punkt];
			const r = drehungen(maske);
			const lege = (p: Punkt) => {
				let x = p;
				for (let s = 0; s < r; s++) x = dreheUV(x);
				return bilinear(q, x);
			};
			const m = modul(klasse);
			zellen.push({
				id: `${i}:${j}`,
				ecken,
				maske,
				klasse,
				flaechen: m.flaechen.map((f) => f.map(lege)),
				kanten: m.kanten.map((k) => k.map(lege)),
				rahmen: q
			});
		}
	return { punkte, belegt, zellen, n };
}

export const pfad = (p: Punkt[], zu = true) =>
	p.length
		? 'M' + p.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join('L') + (zu ? 'Z' : '')
		: '';

/** Counts cells per class (order as in eckKlassen). */
export function klassenHistogramm(r: EckRaster) {
	return eckKlassen.map((k) => r.zellen.filter((z) => z.klasse === k.maske).length);
}
