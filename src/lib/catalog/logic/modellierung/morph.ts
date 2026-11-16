/**
 * Teaching version "Fixed carrier, moving embedding": a quad carrier with fixed topology,
 * two embeddings (square, organic) and a purely parametric lerp between them.
 * Each cell's normalized Jacobian J_s is checked; J_s ≤ 0 means flipped.
 */
import { random } from '../parametrik/random';
import type { Punkt } from './netz';
import { bilinear } from './eck';

export type Rand = 'konvex' | 'gelappt';
export type MorphOptionen = { saat: number; n?: number; staerke?: number; rand?: Rand };
export type Traeger = { n: number; quads: [number, number, number, number][] };
export type Lagen = { traeger: Traeger; a: Float64Array; b: Float64Array };

export function traeger(n: number): Traeger {
	const quads: [number, number, number, number][] = [];
	for (let j = 0; j < n; j++)
		for (let i = 0; i < n; i++) {
			const k = j * (n + 1) + i;
			quads.push([k, k + 1, k + n + 2, k + n + 1]);
		}
	return { n, quads };
}

/** Embedding A: square. Embedding B: compressed by density, smoothly swirled, optionally a lobed boundary. */
export function lagen(o: MorphOptionen): Lagen {
	const n = o.n ?? 12,
		s = o.staerke ?? 0.5,
		gelappt = (o.rand ?? 'konvex') === 'gelappt';
	const rng = random(o.saat);
	const p1 = rng() * 6.283,
		p2 = rng() * 6.283,
		lappen = 3 + Math.floor(rng() * 3);
	const c: Punkt = [n * (0.4 + rng() * 0.2), n * (0.4 + rng() * 0.2)];
	const a = new Float64Array((n + 1) * (n + 1) * 2),
		b = new Float64Array(a.length);
	for (let j = 0; j <= n; j++)
		for (let i = 0; i <= n; i++) {
			const k = (j * (n + 1) + i) * 2;
			a[k] = i;
			a[k + 1] = j;
			// Distance to the boundary (0 at the boundary, 1 in the middle) keeps the convex boundary fixed.
			const innen = Math.min(i, j, n - i, n - j) / (n / 2);
			const dx = i - c[0],
				dy = j - c[1];
			// Density weight: compressed toward the center.
			const stauch = 1 - 0.35 * s * innen;
			let x = c[0] + dx * stauch,
				y = c[1] + dy * stauch;
			// Smooth swirl.
			x += s * 1.6 * innen * Math.sin(j / 2.2 + p1);
			y += s * 1.6 * innen * Math.sin(i / 2.6 + p2);
			if (gelappt) {
				const m: Punkt = [n / 2, n / 2];
				const w = Math.atan2(y - m[1], x - m[0]);
				const r = Math.max(Math.abs(i - m[0]), Math.abs(j - m[1])) / (n / 2);
				const f = 1 + s * 0.55 * r ** 3 * Math.sin(lappen * w + p1);
				x = m[0] + (x - m[0]) * f;
				y = m[1] + (y - m[1]) * f;
			}
			b[k] = x;
			b[k + 1] = y;
		}
	return { traeger: traeger(n), a, b };
}

export function lage(l: Lagen, t: number) {
	const p = new Float64Array(l.a.length);
	for (let k = 0; k < p.length; k++) p[k] = l.a[k] + (l.b[k] - l.a[k]) * t;
	return p;
}

/** Normalized Jacobian per quad: smallest corner sine (positive = valid, ≤ 0 = flipped). */
export function jacobiane(pos: Float64Array, t: Traeger) {
	const out = new Float64Array(t.quads.length);
	t.quads.forEach((q, f) => {
		let m = Infinity;
		for (let c = 0; c < 4; c++) {
			const p = q[c],
				nx = q[(c + 1) % 4],
				pv = q[(c + 3) % 4];
			const ax = pos[nx * 2] - pos[p * 2],
				ay = pos[nx * 2 + 1] - pos[p * 2 + 1];
			const bx = pos[pv * 2] - pos[p * 2],
				by = pos[pv * 2 + 1] - pos[p * 2 + 1];
			const la = Math.hypot(ax, ay),
				lb = Math.hypot(bx, by);
			m = Math.min(m, la > 1e-12 && lb > 1e-12 ? (ax * by - ay * bx) / (la * lb) : -1);
		}
		out[f] = m;
	});
	return out;
}

export type Pruefung = { minJ: number; gekippt: number; g1: number; ersteFaltung: number | null };

/** Checks the embedding at t and the whole motion over 65 sample points (as in E2). */
export function pruefe(l: Lagen, t: number, proben = 65): Pruefung {
	const j = jacobiane(lage(l, t), l.traeger);
	let minJ = Infinity,
		gekippt = 0;
	for (const v of j) {
		minJ = Math.min(minJ, v);
		if (v <= 0) gekippt++;
	}
	let ersteFaltung: number | null = null;
	for (let s = 0; s < proben && ersteFaltung === null; s++) {
		const ts = s / (proben - 1);
		if (jacobiane(lage(l, ts), l.traeger).some((v) => v <= 0)) ersteFaltung = ts;
	}
	// G1: largest vertex movement per sample step relative to the mean edge length (limit 0.1).
	let weg = 0;
	for (let k = 0; k < l.a.length; k += 2)
		weg = Math.max(weg, Math.hypot(l.b[k] - l.a[k], l.b[k + 1] - l.a[k + 1]));
	return { minJ, gekippt, g1: weg / (proben - 1), ersteFaltung };
}

/** Maps a point in block coordinates (U, V ∈ [0, groesse]) through the carrier cells. */
export function traegerPunkt(pos: Float64Array, n: number, [U, V]: Punkt): Punkt {
	const i = Math.min(n - 1, Math.max(0, Math.floor(U))),
		j = Math.min(n - 1, Math.max(0, Math.floor(V)));
	const k = (jj: number, ii: number): Punkt => [
		pos[(jj * (n + 1) + ii) * 2],
		pos[(jj * (n + 1) + ii) * 2 + 1]
	];
	return bilinear([k(j, i), k(j, i + 1), k(j + 1, i + 1), k(j + 1, i)], [U - i, V - j]);
}
