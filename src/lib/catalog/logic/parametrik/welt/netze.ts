/**
 * Block grids of the world: nine systems from strict to freely organic. Each returns macro cells
 * (one block per cell) and splits them into pre-cells; `toPatch` (raster/universal) turns them into
 * the quads of the corner modules. Rule for all systems: every block edge carries the same number
 * of divisions, so triangle, quad and n-gon fit together without a seam.
 *   quad     → bilinear grid
 *   triangle → k² small triangles
 *   hexagon  → three rhombi
 *   n-gon    → n kites around the centroid, or a fan of triangles (Voronoi, organic)
 * Pure function of seed and sliders; no indices leave this file.
 */
import { random } from '../random';
import { count } from '../types';
import type { Cell, Point2 } from '../vocab';
import { cell, clip } from '../raster/geometry';
import type { UniversalGrid } from '../raster/universal';

export type RasterId =
	| 'quadrat'
	| 'achsen'
	| 'dreieck'
	| 'sechseck'
	| 'polar'
	| 'kontur'
	| 'voronoi'
	| 'viereck'
	| 'organisch';

export const rasterarten: { id: RasterId; name: string; regel: string }[] = [
	{ id: 'quadrat', name: 'Square', regel: 'Blocks of 30 m, all alleys at right angles.' },
	{ id: 'achsen', name: 'Axes', regel: 'Narrow and wide bands alternating.' },
	{ id: 'dreieck', name: 'Triangle', regel: 'Triangular blocks, alleys in three directions.' },
	{
		id: 'sechseck',
		name: 'Hexagon',
		regel: 'Honeycomb blocks of three rhombi, alleys without crossings.'
	},
	{
		id: 'polar',
		name: 'Polar',
		regel: 'Rings around a round square, twice as many blocks on the outside.'
	},
	{ id: 'kontur', name: 'Contour', regel: 'Bands follow a curved guideline.' },
	{
		id: 'voronoi',
		name: 'Voronoi',
		regel: 'Blocks around scattered centers, alleys halfway between.'
	},
	{
		id: 'viereck',
		name: 'Free quad',
		regel: 'Triangles randomly paired into rhombi, distorted.'
	},
	{ id: 'organisch', name: 'Organic', regel: 'Dense center, curved alleys, grown edge.' }
];

export type RasterParams = {
	raster: RasterId;
	seed: number;
	/** Blocks per side (3–6): size of the district. */
	groesse: number;
	/** Block size as a factor (0.8–1.3). */
	mass: number;
	/** Distortion of the whole mesh (0–1): from the ruler to the grown city. */
	verzug: number;
};

export type Makro = { id: string; polygon: Point2[] };
export type Netz = { grid: UniversalGrid; makros: Makro[] };

type Roh = { polygon: Point2[]; teile: Point2[][] };
type Abb = (u: number, v: number) => Point2;

const lerp = (a: Point2, b: Point2, t: number): Point2 => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t
];
const mittel = (ps: Point2[]): Point2 => [
	ps.reduce((s, q) => s + q[0], 0) / ps.length,
	ps.reduce((s, q) => s + q[1], 0) / ps.length
];
const polar = (r: number, a: number): Point2 => [r * Math.cos(a), r * Math.sin(a)];
const bilinear =
	([a, b, c, d]: Point2[]): Abb =>
	(u, v) =>
		lerp(lerp(a, b, u), lerp(d, c, u), v);

/** Grid of nx × ny pre-cells over a mapping of the unit square. */
function gitter(f: Abb, nx: number, ny: number): Point2[][] {
	const out: Point2[][] = [];
	for (let i = 0; i < nx; i++)
		for (let j = 0; j < ny; j++)
			out.push([
				f(i / nx, j / ny),
				f((i + 1) / nx, j / ny),
				f((i + 1) / nx, (j + 1) / ny),
				f(i / nx, (j + 1) / ny)
			]);
	return out;
}
/** Triangle into k² small triangles. */
function dreiecke([a, b, c]: Point2[], k: number): Point2[][] {
	const at = (i: number, j: number): Point2 => [
		a[0] + ((b[0] - a[0]) * i + (c[0] - a[0]) * j) / k,
		a[1] + ((b[1] - a[1]) * i + (c[1] - a[1]) * j) / k
	];
	const out: Point2[][] = [];
	for (let j = 0; j < k; j++)
		for (let i = 0; i + j < k; i++) {
			out.push([at(i, j), at(i + 1, j), at(i, j + 1)]);
			if (i + j < k - 1) out.push([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
		}
	return out;
}
/** n-gon into n kites around the centroid, each with q × q pre-cells. */
function drachen(p: Point2[], q: number, c = mittel(p)): Point2[][] {
	const n = p.length,
		mid = p.map((v, i) => lerp(v, p[(i + 1) % n], 0.5));
	return p.flatMap((v, i) => gitter(bilinear([v, mid[i], c, mid[(i + n - 1) % n]]), q, q));
}
/** n-gon as a fan of n triangles around the centroid, each into k² small triangles. */
function faecher(p: Point2[], k: number): Point2[][] {
	const c = mittel(p);
	return p.flatMap((v, i) => dreiecke([c, v, p[(i + 1) % p.length]], k));
}
/** Division by corner count; `e` = divisions per block edge after `toPatch` (4, 6 or 8). */
function teile(p: Point2[], e: number): Point2[][] {
	if (p.length === 4) return gitter(bilinear(p), e / 2, e / 2);
	if (p.length === 3) return dreiecke(p, e / 2);
	return drachen(p, Math.max(1, Math.round(e / 4)));
}

/* ── The nine systems ── */

function quadrat(g: number, s: number): Roh[] {
	const out: Roh[] = [];
	for (let i = 0; i < g; i++)
		for (let j = 0; j < g; j++) {
			const x = (i - g / 2) * s,
				y = (j - g / 2) * s,
				polygon: Point2[] = [
					[x, y],
					[x + s, y],
					[x + s, y + s],
					[x, y + s]
				];
			out.push({ polygon, teile: teile(polygon, 6) });
		}
	return out;
}

function achsen(g: number, s: number, rng: () => number): Roh[] {
	// Rhythm narrow · wide · medium; the division follows the width (10 m per pre-cell).
	const band = (off: number) => {
		const n = Array.from({ length: g }, (_, k) => [2, 4, 3][(k + off) % 3]),
			total = n.reduce((a, b) => a + b, 0);
		let at = -total / 2;
		return n.map((w) => {
			const from = at;
			at += w;
			return { from: (from * s) / 3, to: (at * s) / 3, n: w };
		});
	};
	const xs = band(Math.floor(rng() * 3)),
		ys = band(Math.floor(rng() * 3));
	return xs.flatMap((x) =>
		ys.map((y) => {
			const polygon: Point2[] = [
				[x.from, y.from],
				[x.to, y.from],
				[x.to, y.to],
				[x.from, y.to]
			];
			return { polygon, teile: gitter(bilinear(polygon), x.n, y.n) };
		})
	);
}

/** Triangular grid: points and triangles within radius r. */
function dreiecksnetz(l: number, r: number) {
	const h = (l * Math.sqrt(3)) / 2,
		n = Math.ceil(r / h) + 2,
		at = (i: number, j: number): Point2 => [(i + j / 2) * l, j * h];
	const out: Point2[][] = [];
	for (let j = -n; j < n; j++)
		for (let i = -n * 2; i < n * 2; i++)
			for (const t of [
				[at(i, j), at(i + 1, j), at(i, j + 1)],
				[at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]
			]) {
				const c = mittel(t);
				if (Math.hypot(c[0], c[1]) <= r) out.push(t);
			}
	return out;
}

function dreieck(g: number, s: number): Roh[] {
	const l = s * 1.35;
	return dreiecksnetz(l, 0.371 * l * g * 1.28 + 1).map((polygon) => ({
		polygon,
		teile: teile(polygon, 6)
	}));
}

function sechseck(g: number, s: number): Roh[] {
	const a = s * 0.66,
		r = 18.5 * (a / 20) * g,
		n = Math.ceil(r / a) + 1,
		out: Roh[] = [];
	for (let q = -n; q <= n; q++)
		for (let k = -n; k <= n; k++) {
			const c: Point2 = [a * 1.5 * q, a * Math.sqrt(3) * (k + q / 2)];
			if (Math.hypot(c[0], c[1]) > r) continue;
			const p = Array.from({ length: 6 }, (_, i): Point2 => [
				c[0] + a * Math.cos((i * Math.PI) / 3),
				c[1] + a * Math.sin((i * Math.PI) / 3)
			]);
			// Three rhombi around the center: the cube in the hexagon.
			out.push({
				polygon: p,
				teile: [0, 2, 4].flatMap((i) => gitter(bilinear([c, p[i], p[i + 1], p[(i + 2) % 6]]), 2, 2))
			});
		}
	return out;
}

function polarnetz(g: number, s: number): Roh[] {
	const r0 = s * 0.7,
		w = s * 1.3,
		ringe = Math.max(1, Math.floor(g / 2)),
		out: Roh[] = [];
	// Round square in the middle: six kites, outer edge on the circle.
	const ecken = Array.from({ length: 6 }, (_, i) => polar(r0, (i * Math.PI) / 3)),
		aufKreis = (p: Point2): Point2 => {
			const d = Math.hypot(p[0], p[1]);
			return d > r0 * 0.83 ? [(p[0] / d) * r0, (p[1] / d) * r0] : p;
		};
	const mid = ecken.map((_, i) => polar(r0, ((i + 0.5) * Math.PI) / 3));
	out.push({
		polygon: Array.from({ length: 24 }, (_, i) => polar(r0, (i * Math.PI) / 12)),
		teile: ecken.flatMap((v, i) =>
			gitter(bilinear([v, mid[i], [0, 0], mid[(i + 5) % 6]]), 2, 2).map((c) => c.map(aufKreis))
		)
	});
	for (let k = 0; k < ringe; k++) {
		const sektoren = 6 * 2 ** k,
			innen = r0 + k * w,
			da = (2 * Math.PI) / sektoren;
		for (let i = 0; i < sektoren; i++) {
			const f: Abb = (u, v) => polar(innen + v * w, (i + u) * da);
			const cells = gitter(f, 4, 4);
			// The next ring has twice as many sectors: a hanging point on the outer arc.
			if (k < ringe - 1)
				for (let c = 0; c < 4; c++) {
					const q = cells[c * 4 + 3];
					q.splice(3, 0, f((c + 0.5) / 4, 1));
				}
			const rand: Point2[] = [];
			for (let t = 0; t < 8; t++) rand.push(f(t / 8, 0));
			for (let t = 0; t < 8; t++) rand.push(f(1, t / 8));
			for (let t = 0; t < 8; t++) rand.push(f(1 - t / 8, 1));
			for (let t = 0; t < 8; t++) rand.push(f(0, 1 - t / 8));
			out.push({ polygon: rand, teile: cells });
		}
	}
	return out;
}

function kontur(g: number, s: number, rng: () => number): Roh[] {
	// Guideline: two opposing arcs (S). Curvature so small that no band folds over.
	const laenge = g * s,
		halb = (g * s) / 2,
		kappa = (0.42 + rng() * 0.1) / halb,
		steps = g * 24,
		ds = laenge / steps,
		linie: { p: Point2; a: number }[] = [];
	let p: Point2 = [0, 0],
		a = -kappa * halb * 0.5;
	for (let k = 0; k <= steps; k++) {
		linie.push({ p, a });
		const kr = k < steps / 2 ? kappa : -kappa;
		p = [p[0] + Math.cos(a + (kr * ds) / 2) * ds, p[1] + Math.sin(a + (kr * ds) / 2) * ds];
		a += kr * ds;
	}
	const m = linie[steps / 2].p;
	const at = (u: number, d: number): Point2 => {
		const q = linie[Math.round(u * steps)];
		return [q.p[0] - m[0] - Math.sin(q.a) * d, q.p[1] - m[1] + Math.cos(q.a) * d];
	};
	const out: Roh[] = [];
	for (let i = 0; i < g; i++)
		for (let j = 0; j < g; j++) {
			const f: Abb = (u, v) => at((i + u) / g, (j + v - g / 2) * s);
			const rand: Point2[] = [];
			for (let t = 0; t < 6; t++) rand.push(f(t / 6, 0));
			for (let t = 0; t < 6; t++) rand.push(f(1, t / 6));
			for (let t = 0; t < 6; t++) rand.push(f(1 - t / 6, 1));
			for (let t = 0; t < 6; t++) rand.push(f(0, 1 - t / 6));
			out.push({ polygon: rand, teile: gitter(f, 3, 3) });
		}
	return out;
}

/** Voronoi cells within a convex boundary, with Lloyd steps. */
function voronoi(sites: Point2[], grenze: Point2[], lloyd: number): Point2[][] {
	let s = sites,
		zellen: Point2[][] = [];
	for (let pass = 0; pass <= lloyd; pass++) {
		zellen = s.map((a, i) => {
			let polygon = grenze;
			s.forEach((b, j) => {
				if (i !== j && polygon.length)
					polygon = clip(
						polygon,
						[b[0] - a[0], b[1] - a[1]],
						(b[0] ** 2 + b[1] ** 2 - a[0] ** 2 - a[1] ** 2) / 2
					);
			});
			return polygon;
		});
		if (pass < lloyd) s = zellen.map((z, i) => (z.length > 2 ? cell(z, '').center : s[i]));
	}
	return zellen;
}
/** Merges short edges: corners closer than `d` collapse (the same for all cells). */
function verschmelzen(zellen: Point2[][], d: number): Point2[][] {
	const pts: Point2[] = [],
		gruppe: number[] = [];
	const find = (p: Point2) => {
		let k = pts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6);
		if (k < 0) {
			k = pts.length;
			pts.push(p);
			gruppe.push(k);
		}
		return k;
	};
	const root = (k: number): number => (gruppe[k] === k ? k : (gruppe[k] = root(gruppe[k])));
	const idx = zellen.map((z) => z.map(find));
	// Merge only real edges, never across a cell.
	for (const z of idx)
		z.forEach((a, i) => {
			const b = z[(i + 1) % z.length];
			if (Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]) < d) gruppe[root(a)] = root(b);
		});
	const sum = new Map<number, Point2[]>();
	pts.forEach((p, k) => sum.set(root(k), [...(sum.get(root(k)) ?? []), p]));
	const neu = new Map([...sum].map(([k, ps]) => [k, mittel(ps)]));
	return idx
		.map((z) => {
			const r = z.map(root).filter((k, i, all) => k !== all[(i + all.length - 1) % all.length]);
			return r.map((k) => neu.get(k)!);
		})
		.filter((z) => z.length >= 3);
}
const kreis = (r: number, n = 40): Point2[] =>
	Array.from({ length: n }, (_, i) => polar(r, (i * 2 * Math.PI) / n));
/** Points with minimum spacing `abstand(p)` (dart throwing, deterministic). */
function streuen(
	rng: () => number,
	r: number,
	abstand: (p: Point2) => number,
	innen: (p: Point2) => boolean
): Point2[] {
	const out: Point2[] = [];
	for (let k = 0; k < 4000; k++) {
		const p: Point2 = [(rng() * 2 - 1) * r, (rng() * 2 - 1) * r];
		if (!innen(p)) continue;
		const d = abstand(p);
		if (out.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= (d + abstand(q)) / 2)) out.push(p);
	}
	return out;
}

function voronoinetz(g: number, s: number, rng: () => number): Roh[] {
	const r = g * s * 0.66,
		sites = streuen(
			rng,
			r * 1.55,
			() => s * 1.15,
			(p) => Math.hypot(p[0], p[1]) < r * 1.5
		),
		innen = sites.map((p) => Math.hypot(p[0], p[1]) < r);
	const zellen = voronoi(sites, kreis(r * 1.8), 2).map((z, i) => (innen[i] ? z : []));
	return verschmelzen(zellen, s * 0.3).map((polygon) => ({ polygon, teile: faecher(polygon, 2) }));
}

function viereck(g: number, s: number, rng: () => number): Roh[] {
	const l = s * 1.07,
		tris = dreiecksnetz(l, 0.371 * l * g * 1.25 + 1),
		key = (p: Point2) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
	// Distortion of the grid points; boundary points stay so that the outline is calm.
	const zahl = new Map<string, number>();
	for (const t of tris) for (const p of t) zahl.set(key(p), (zahl.get(key(p)) ?? 0) + 1);
	const versatz = new Map<string, Point2>();
	for (const [k, n] of [...zahl].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
		const a = rng() * 6.283,
			d = n === 6 ? l * 0.2 * rng() : 0;
		versatz.set(k, [Math.cos(a) * d, Math.sin(a) * d]);
	}
	const zieh = (p: Point2): Point2 => {
		const v = versatz.get(key(p))!;
		return [p[0] + v[0], p[1] + v[1]];
	};
	// Random pairing across a shared edge (Townscaper): rhombi, the rest stays triangles.
	const frei = new Set(tris.map((_, i) => i)),
		order = tris.map((_, i) => i),
		polys: Point2[][] = [];
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	for (const i of order) {
		if (!frei.has(i)) continue;
		frei.delete(i);
		const a = tris[i],
			ka = a.map(key);
		const kandidaten = [...frei].filter(
			(j) => tris[j].filter((p) => ka.includes(key(p))).length === 2
		);
		const partner =
			rng() < 0.9 && kandidaten.length
				? kandidaten[Math.floor(rng() * kandidaten.length)]
				: undefined;
		if (partner === undefined) {
			polys.push(a);
			continue;
		}
		frei.delete(partner);
		const b = tris[partner],
			kb = b.map(key),
			solo = a.findIndex((p) => !kb.includes(key(p))),
			fern = b.find((p) => !ka.includes(key(p)))!;
		polys.push([a[solo], a[(solo + 1) % 3], fern, a[(solo + 2) % 3]]);
	}
	return polys.map((q) => {
		const polygon = q.map(zieh);
		return { polygon, teile: teile(polygon, 6) };
	});
}

function organisch(g: number, s: number, rng: () => number): Roh[] {
	const r = g * s,
		ph = [rng() * 6.283, rng() * 6.283, rng() * 6.283];
	// Grown edge: centers only inside a lobed shape.
	const form = (p: Point2) => {
		const a = Math.atan2(p[1], p[0]);
		return (
			Math.hypot(p[0], p[1]) <
			r * (0.74 + 0.15 * Math.sin(2 * a + ph[0]) + 0.1 * Math.sin(3 * a + ph[1]))
		);
	};
	// Density field: tight blocks in the middle, wide ones at the edge.
	const dichte = (p: Point2) => s * (0.9 + 0.6 * (Math.hypot(p[0], p[1]) / r));
	const sites = streuen(rng, r, dichte, (p) => Math.hypot(p[0], p[1]) < r * 1.15),
		innen = sites.map(form);
	const zellen = voronoi(sites, kreis(r * 1.3), 1).map((z, i) => (innen[i] ? z : []));
	return verschmelzen(zellen, s * 0.28).map((polygon) => ({
		polygon,
		teile: faecher(polygon, 2)
	}));
}

/** Flow field: swirl around the center plus two long waves. Bends alleys and block edges. */
function stroemung(staerke: number, r: number, rng: () => number): (p: Point2) => Point2 {
	const ph = rng() * 6.283,
		ph2 = rng() * 6.283,
		drall = (rng() < 0.5 ? -1 : 1) * 0.55 * staerke,
		amp = 0.075 * r * staerke;
	return (p) => {
		const d = Math.hypot(p[0], p[1]) / r,
			a = drall * (1 - Math.min(1, d)) ** 1.5,
			x = p[0] * Math.cos(a) - p[1] * Math.sin(a),
			y = p[0] * Math.sin(a) + p[1] * Math.cos(a);
		return [x + amp * Math.sin((y / r) * 2.4 + ph), y + amp * Math.sin((x / r) * 2.1 + ph2)];
	};
}

/** Block grid as pre-cells for `toPatch`; cell IDs carry the macro cell (`m07/3`). */
export function netz(p: RasterParams): Netz {
	const rng = random((p.seed >>> 0) * 7919 + 11),
		g = count(p.groesse, 3, 6),
		s = 30 * Math.max(0.8, Math.min(1.3, p.mass)),
		verzug = Math.max(0, Math.min(1, p.verzug));
	const roh =
		p.raster === 'achsen'
			? achsen(g, s, rng)
			: p.raster === 'dreieck'
				? dreieck(g, s)
				: p.raster === 'sechseck'
					? sechseck(g, s)
					: p.raster === 'polar'
						? polarnetz(g, s)
						: p.raster === 'kontur'
							? kontur(g, s, rng)
							: p.raster === 'voronoi'
								? voronoinetz(g, s, rng)
								: p.raster === 'viereck'
									? viereck(g, s, rng)
									: p.raster === 'organisch'
										? organisch(g, s, rng)
										: quadrat(g, s);
	// The organic grid is always curved; all others only with the slider.
	const staerke = p.raster === 'organisch' ? 0.55 + 0.45 * verzug : verzug;
	const r = Math.max(1, ...roh.flatMap((m) => m.polygon.map((q) => Math.hypot(q[0], q[1])))),
		fluss = stroemung(staerke, r, rng),
		// Round to 0.1 mm: points on shared edges reliably coincide.
		fest = (q: Point2): Point2 => {
			const w = staerke ? fluss(q) : q;
			return [Math.round(w[0] * 1e4) / 1e4, Math.round(w[1] * 1e4) / 1e4];
		};
	// Center of the district at the origin: camera, proximity and railway compute from there.
	const roh2 = roh.map((m) => ({
			polygon: m.polygon.map(fest),
			teile: m.teile.map((t) => t.map(fest))
		})),
		xs = roh2.flatMap((m) => m.polygon.map((q) => q[0])),
		ys = roh2.flatMap((m) => m.polygon.map((q) => q[1])),
		mx = Math.round(((Math.min(...xs) + Math.max(...xs)) / 2) * 1e4) / 1e4,
		my = Math.round(((Math.min(...ys) + Math.max(...ys)) / 2) * 1e4) / 1e4,
		zur = (q: Point2): Point2 => [
			Math.round((q[0] - mx) * 1e4) / 1e4,
			Math.round((q[1] - my) * 1e4) / 1e4
		];
	const makros: Makro[] = [],
		cells: Cell[] = [];
	roh2.forEach((m, k) => {
		const id = `m${String(k).padStart(3, '0')}`;
		makros.push({ id, polygon: m.polygon.map(zur) });
		m.teile.forEach((t, i) => cells.push(cell(t.map(zur), `${id}/${String(i).padStart(2, '0')}`)));
	});
	const all = cells.flatMap((c) => c.polygon);
	return {
		makros,
		grid: {
			kind: p.raster === 'organisch' ? 'organic' : 'quad-irregular',
			cells,
			links: [],
			bounds: {
				min: [Math.min(...all.map((q) => q[0])), Math.min(...all.map((q) => q[1]))],
				max: [Math.max(...all.map((q) => q[0])), Math.max(...all.map((q) => q[1]))]
			}
		}
	};
}
