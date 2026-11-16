/**
 * Teaching version "Fields": a smooth direction field with density (glyphs and field lines)
 * and a distance field (SDF) from three circles with a soft union (isolines).
 * Fields only suggest; they never make decisions about topology.
 */
import { random } from '../parametrik/random';
import type { Punkt } from './netz';

/** `kern`: density center in m on [0, 100]²; taken from the seed if not given. */
export type FeldOptionen = { saat: number; wirbel: number; kern?: Punkt };

export function richtungsfeld(o: FeldOptionen) {
	const rng = random(o.saat);
	const p1 = rng() * 6.283,
		p2 = rng() * 6.283;
	// The seed center is always drawn, so that the draw sequence stays the same with and without `kern`.
	const saatKern: Punkt = [30 + rng() * 40, 30 + rng() * 40];
	const c: Punkt = o.kern ?? saatKern;
	const winkel = (x: number, y: number) =>
		0.2 + o.wirbel * (0.9 * Math.sin(x / 22 + p1) + 0.7 * Math.sin(y / 18 + p2));
	const dichte = (x: number, y: number) =>
		Math.max(0.15, Math.exp(-((x - c[0]) ** 2 + (y - c[1]) ** 2) / (2 * 28 * 28)));
	return { winkel, dichte, kern: c };
}

/** Glyphs on a grid (100 × 100): short strokes along the field direction, length ∝ density. */
export function glyphen(o: FeldOptionen, zahl = 14): Punkt[][] {
	const f = richtungsfeld(o);
	const out: Punkt[][] = [];
	const s = 100 / zahl;
	for (let j = 0; j < zahl; j++)
		for (let i = 0; i < zahl; i++) {
			const x = (i + 0.5) * s,
				y = (j + 0.5) * s;
			const w = f.winkel(x, y),
				l = s * (0.2 + 0.25 * f.dichte(x, y));
			out.push([
				[x - Math.cos(w) * l, y - Math.sin(w) * l],
				[x + Math.cos(w) * l, y + Math.sin(w) * l]
			]);
		}
	return out;
}

/** Field lines (Euler, 1.5 m steps) from fixed seed points, in both directions. */
export function feldlinien(o: FeldOptionen, zahl = 7): Punkt[][] {
	const f = richtungsfeld(o);
	const linien: Punkt[][] = [];
	for (let k = 0; k < zahl; k++) {
		const start: Punkt = [50, ((k + 0.5) / zahl) * 100];
		const halb = (vor: number) => {
			const pts: Punkt[] = [];
			let [x, y] = start;
			for (let s = 0; s < 120; s++) {
				const w = f.winkel(x, y);
				x += Math.cos(w) * 1.5 * vor;
				y += Math.sin(w) * 1.5 * vor;
				if (x < 0 || x > 100 || y < 0 || y > 100) break;
				pts.push([x, y]);
			}
			return pts;
		};
		linien.push([...halb(-1).reverse(), start, ...halb(1)]);
	}
	return linien;
}

/** SDF: soft union of three circles (polynomial smin, k in meters); `erster` moves circle 1. */
export function sdf(saat: number, k: number, erster?: Punkt) {
	const rng = random(saat ^ 0x2545f491);
	const kreise = Array.from({ length: 3 }, (_, i) => ({
		c: [30 + rng() * 40, 25 + i * 22 + rng() * 6] as Punkt,
		r: 9 + rng() * 9
	}));
	if (erster) kreise[0].c = erster;
	const smin = (a: number, b: number) => {
		if (k <= 0) return Math.min(a, b);
		const h = Math.max(k - Math.abs(a - b), 0) / k;
		return Math.min(a, b) - (h * h * k) / 4;
	};
	return (x: number, y: number) =>
		kreise.map((c) => Math.hypot(x - c.c[0], y - c.c[1]) - c.r).reduce(smin);
}

export type Turm = { x: number; y: number; seite: number; hoehe: number };

/**
 * Attraction: a point attracts height. n × n buildings on [0, 100]²; height in m falls with the
 * distance to the source, Gaussian, from `hoehe` to `basis`. Order: back to front (y, then x).
 */
export function anziehung(
	quelle: Punkt,
	o: { n?: number; radius?: number; hoehe?: number; basis?: number } = {}
): Turm[] {
	const n = o.n ?? 9,
		radius = o.radius ?? 26,
		hoehe = o.hoehe ?? 28,
		basis = o.basis ?? 3;
	const s = 100 / n;
	const out: Turm[] = [];
	for (let j = 0; j < n; j++)
		for (let i = 0; i < n; i++) {
			const x = (i + 0.5) * s,
				y = (j + 0.5) * s;
			const d = Math.hypot(x - quelle[0], y - quelle[1]);
			out.push({
				x,
				y,
				seite: s * 0.56,
				hoehe: basis + (hoehe - basis) * Math.exp(-((d / radius) ** 2))
			});
		}
	return out;
}

/** Marching squares: isoline segments of a scalar field on [0, 100]². */
export function isolinien(
	feld: (x: number, y: number) => number,
	stufe: number,
	n = 60
): Punkt[][] {
	const s = 100 / n;
	const w = new Float64Array((n + 1) * (n + 1));
	for (let j = 0; j <= n; j++)
		for (let i = 0; i <= n; i++) w[j * (n + 1) + i] = feld(i * s, j * s) - stufe;
	const out: Punkt[][] = [];
	const lerp = (a: Punkt, b: Punkt, va: number, vb: number): Punkt => {
		const t = va / (va - vb);
		return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
	};
	for (let j = 0; j < n; j++)
		for (let i = 0; i < n; i++) {
			const p: Punkt[] = [
				[i * s, j * s],
				[(i + 1) * s, j * s],
				[(i + 1) * s, (j + 1) * s],
				[i * s, (j + 1) * s]
			];
			const v = [
				w[j * (n + 1) + i],
				w[j * (n + 1) + i + 1],
				w[(j + 1) * (n + 1) + i + 1],
				w[(j + 1) * (n + 1) + i]
			];
			const schnitt: Punkt[] = [];
			for (let e = 0; e < 4; e++) {
				const a = v[e],
					b = v[(e + 1) % 4];
				if (a < 0 !== b < 0) schnitt.push(lerp(p[e], p[(e + 1) % 4], a, b));
			}
			if (schnitt.length === 2) out.push(schnitt);
			else if (schnitt.length === 4) out.push([schnitt[0], schnitt[1]], [schnitt[2], schnitt[3]]);
		}
	return out;
}

export const segmente = (linien: Punkt[][]) =>
	linien
		.filter((l) => l.length > 1)
		.map((l) => 'M' + l.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L'))
		.join('');
