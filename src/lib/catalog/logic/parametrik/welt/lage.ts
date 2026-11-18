import { perimeterHull } from '../perimeter-hull';
/**
 * Layout of the world on an arbitrary quad patch (raster/universal → eckraster/topology).
 * Everything here is graph and geometry, no index: a block is the set of build cells of a
 * macro cell, its fringe the closed loop of alley cells around it. Ring, depth, corners and
 * sides follow from the fringe and therefore apply to square, honeycomb, ring segment and free form.
 */
import { random } from '../random';
import type { Point2 } from '../vocab';
import { assemble, type Patch } from '../eckraster/topology';
import { index } from '../eckraster/derive';
import { toPatch } from '../raster/universal';
import { netz, type RasterParams } from './netze';

/** Bend in the fringe from which a block corner counts (radians). */
const ECKE = (28 * Math.PI) / 180;

export type Seite = {
	/** Ring cells of the side in running direction, without the corner cells. */
	cells: string[];
	/** Corner cells at the start and end (missing for round blocks). */
	ecken: [string | undefined, string | undefined];
	richtung: number;
	laenge: number;
};
export type Block = {
	id: string;
	/** Build cells of the block. */
	cells: string[];
	center: Point2;
	/** Proximity to the center: 1 (center) to 0 (edge). */
	naehe: number;
	seed: number;
	/** Alley cells around the block, counterclockwise. */
	saum: string[];
	/** Depth per build cell: 1 = on the fringe (ring), 2 = behind it, … */
	tiefe: Map<string, number>;
	/** Direction of the fringe at every ring cell (radians): ridge direction of the perimeter block. */
	first: Map<string, number>;
	/** Block corners: ring cell and outer corner point. */
	ecken: { cell: string; punkt: Point2 }[];
	seiten: Seite[];
	/** Mean edge length in the block in meters. */
	pitch: number;
	/** Mean area of a build cell in m². */
	zelle: number;
};
export type Lage = {
	patch: Patch;
	feldRueckfall?: number;
	blocks: Block[];
	/** Block of a build cell; alleys and boundary are missing. */
	blockOf: Map<string, Block>;
	point: Map<string, Point2>;
	nb: Map<string, string[]>;
	rand: Set<string>;
	/** Outlines of the district (patch boundaries), counterclockwise. */
	umrisse: Point2[][];
	/** Track outside along the west side and the two build cells at the platform. */
	bahn: Point2[];
	bahnsteig: string[];
	extent: number;
	/** Quality of the mesh from `toPatch`. */
	guete: {
		minAngle: number;
		minArea: number;
		maxAspect: number;
		js?: number;
		stufe?: 0 | 1 | 2;
		haengend?: number;
		fehler?: string[];
	};
	kern?: { model: import('../raster/universal/kern').Model };
};

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const flaeche = (p: Point2[]) =>
	p.reduce((s, a, i) => {
		const b = p[(i + 1) % p.length];
		return s + a[0] * b[1] - b[0] * a[1];
	}, 0) / 2;

/** Closes a point set into a loop via its neighborhood; otherwise sorts around the center. */
function zug(ids: string[], nb: (id: string) => string[], pt: (id: string) => Point2): string[] {
	const set = new Set(ids),
		start = [...ids].sort()[0],
		out = [start],
		seen = new Set(out);
	for (;;) {
		const next = nb(out[out.length - 1])
			.filter((n) => set.has(n) && !seen.has(n))
			.sort()[0];
		if (!next) break;
		out.push(next);
		seen.add(next);
	}
	const closed = out.length === ids.length && nb(out[out.length - 1]).includes(start);
	let loop = out;
	if (!closed) {
		const c: Point2 = [
			ids.reduce((s, id) => s + pt(id)[0], 0) / ids.length,
			ids.reduce((s, id) => s + pt(id)[1], 0) / ids.length
		];
		const w = (id: string) => Math.atan2(pt(id)[1] - c[1], pt(id)[0] - c[0]);
		loop = [...ids].sort((a, b) => w(a) - w(b) || (a < b ? -1 : 1));
	}
	return flaeche(loop.map(pt)) < 0 ? loop.reverse() : loop;
}

function block(
	id: string,
	cells: string[],
	patch: Patch,
	point: Map<string, Point2>,
	blockOf: Map<string, unknown>,
	areaOf: Map<string, number>
): Omit<Block, 'naehe' | 'seed'> {
	const ix = index(patch),
		set = new Set(cells),
		pt = (v: string) => point.get(v)!;
	const center: Point2 = [
		cells.reduce((s, v) => s + pt(v)[0], 0) / cells.length,
		cells.reduce((s, v) => s + pt(v)[1], 0) / cells.length
	];
	const saumSet = new Set<string>();
	for (const c of cells) for (const n of ix.around.get(c)!) if (!blockOf.has(n)) saumSet.add(n);
	const saum = zug([...saumSet], (v) => ix.vertex.get(v)!.neighbors, pt),
		sp = saum.map(pt),
		n = sp.length;
	// Arc length along the fringe.
	const lauf = [0];
	for (let k = 0; k < n; k++)
		lauf.push(lauf[k] + Math.hypot(sp[(k + 1) % n][0] - sp[k][0], sp[(k + 1) % n][1] - sp[k][1]));
	const umfang = lauf[n];
	/** Nearest point on the fringe: arc length and direction there. */
	const fuss = (q: Point2) => {
		let best = { d: Infinity, s: 0, a: 0 };
		for (let k = 0; k < n; k++) {
			const a = sp[k],
				b = sp[(k + 1) % n],
				dx = b[0] - a[0],
				dy = b[1] - a[1],
				l2 = dx * dx + dy * dy || 1,
				t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)),
				d = Math.hypot(a[0] + dx * t - q[0], a[1] + dy * t - q[1]);
			if (d < best.d) best = { d, s: lauf[k] + t * Math.sqrt(l2), a: Math.atan2(dy, dx) };
		}
		return best;
	};
	const ringSet = new Set(cells.filter((c) => ix.around.get(c)!.some((v) => saumSet.has(v))));
	const tiefe = new Map<string, number>([...ringSet].map((c) => [c, 1]));
	const queue = [...ringSet];
	for (let i = 0; i < queue.length; i++)
		for (const w of ix.vertex.get(queue[i])!.neighbors)
			if (set.has(w) && !tiefe.has(w)) {
				tiefe.set(w, tiefe.get(queue[i])! + 1);
				queue.push(w);
			}
	for (const c of cells) if (!tiefe.has(c)) tiefe.set(c, 2);
	const lage = new Map([...ringSet].map((c) => [c, fuss(pt(c))]));
	const first = new Map([...lage].map(([c, f]) => [c, f.a]));
	// Corners: a bend in the fringe; the next ring cell becomes the corner house.
	const knicke: number[] = [];
	for (let k = 0; k < n; k++) {
		const a = sp[(k + n - 1) % n],
			b = sp[k],
			c = sp[(k + 1) % n];
		let w = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
		while (w > Math.PI) w -= 2 * Math.PI;
		while (w < -Math.PI) w += 2 * Math.PI;
		if (w > ECKE) knicke.push(k);
	}
	const vergeben = new Set<string>();
	const ecken: (Block['ecken'][number] & { s: number })[] = [];
	for (const k of knicke) {
		const d = (c: string) => Math.hypot(pt(c)[0] - sp[k][0], pt(c)[1] - sp[k][1]);
		const cell = [...ringSet]
			.filter((c) => !vergeben.has(c))
			.sort((a, b) => d(a) - d(b) || (a < b ? -1 : 1))[0];
		if (!cell) continue;
		vergeben.add(cell);
		ecken.push({
			cell,
			punkt: [(pt(cell)[0] + sp[k][0]) / 2, (pt(cell)[1] + sp[k][1]) / 2],
			s: lauf[k]
		});
	}
	// Sides: ring cells between two corners, ordered by arc length.
	const frei = [...ringSet]
		.filter((c) => !vergeben.has(c))
		.sort((a, b) => lage.get(a)!.s - lage.get(b)!.s || (a < b ? -1 : 1));
	const seiten: Seite[] = [];
	const seite = (cs: string[], e: Seite['ecken'], laenge: number) => {
		if (!cs.length) return;
		const a = pt(cs[0]),
			b = pt(cs[cs.length - 1]);
		seiten.push({
			cells: cs,
			ecken: e,
			richtung: cs.length > 1 ? Math.atan2(b[1] - a[1], b[0] - a[0]) : first.get(cs[0])!,
			laenge
		});
	};
	if (ecken.length < 2) seite(frei, [ecken[0]?.cell, ecken[0]?.cell], umfang);
	else
		ecken.forEach((e, k) => {
			const next = ecken[(k + 1) % ecken.length],
				span = (next.s - e.s + umfang) % umfang || umfang;
			const rel = (c: string) => (lage.get(c)!.s - e.s + umfang) % umfang;
			seite(
				frei.filter((c) => rel(c) < span).sort((a, b) => rel(a) - rel(b) || (a < b ? -1 : 1)),
				[e.cell, next.cell],
				span
			);
		});
	let sum = 0,
		zahl = 0;
	for (const c of cells)
		for (const w of ix.vertex.get(c)!.neighbors) {
			sum += Math.hypot(pt(w)[0] - pt(c)[0], pt(w)[1] - pt(c)[1]);
			zahl++;
		}
	return {
		id,
		cells,
		center,
		saum,
		tiefe,
		first,
		ecken: ecken.map(({ cell, punkt }) => ({ cell, punkt })),
		seiten,
		pitch: zahl ? sum / zahl : 5,
		zelle: cells.reduce((s, c) => s + (areaOf.get(c) ?? 25), 0) / cells.length
	};
}

export type LageParams = RasterParams & { relax: number };

/** Patch and block structure from grid, seed and sliders. */
export function lage(p: LageParams): Lage {
	const n = netz(p),
		patch = toPatch(n.grid, {
			seed: p.seed >>> 0,
			iterations: Math.max(0, Math.min(6, Math.round(p.relax)))
		});
	// Build cell of a block: all source cells in the same macro cell, not on the boundary.
	const groups = new Map<string, string[]>();
	for (const v of patch.vertices) {
		if (v.boundary) continue;
		const makros = new Set(patch.origins.get(v.id)!.cells.map((c) => c.split('/')[0]));
		if (makros.size !== 1) continue;
		const m = [...makros][0];
		groups.set(m, [...(groups.get(m) ?? []), v.id]);
	}
	return {
		...ausPatch(
			patch,
			groups,
			p.seed,
			patch.quality,
			new Map(patch.cells.map((c) => [c.id, c.area]))
		),
		...(n.feldRueckfall === undefined ? {} : { feldRueckfall: n.feldRueckfall })
	};
}
function boundaryNeighbors(patch: Patch) {
	// Outlines: close boundary edges (only one face) into loops.
	const kanten = new Map<string, { a: string; b: string; n: number }>();
	for (const f of patch.faces)
		f.vertices.forEach((a, i) => {
			const b = f.vertices[(i + 1) % 4],
				k = a < b ? `${a}\n${b}` : `${b}\n${a}`,
				e = kanten.get(k);
			if (e) e.n++;
			else kanten.set(k, { a, b, n: 1 });
		});
	const randNb = new Map<string, string[]>();
	for (const { a, b, n } of kanten.values())
		if (n === 1) {
			randNb.set(a, [...(randNb.get(a) ?? []), b]);
			randNb.set(b, [...(randNb.get(b) ?? []), a]);
		}
	return randNb;
}

function boundaryLoops(patch: Patch, point: Map<string, Point2>) {
	const randNb = boundaryNeighbors(patch);
	const umrisse: Point2[][] = [],
		offen = new Set([...randNb.keys()].sort());
	while (offen.size) {
		const loop = [offen.values().next().value!];
		offen.delete(loop[0]);
		for (;;) {
			const next = (randNb.get(loop[loop.length - 1]) ?? []).filter((v) => offen.has(v)).sort()[0];
			if (!next) break;
			offen.delete(next);
			loop.push(next);
		}
		const poly = loop.map((v) => point.get(v)!);
		if (poly.length > 2) umrisse.push(flaeche(poly) < 0 ? poly.reverse() : poly);
	}
	umrisse.sort((a, b) => flaeche(b) - flaeche(a));
	return umrisse;
}

export function ausPatch(
	patch: Patch,
	groups: Map<string, string[]>,
	seed: number,
	guete: Lage['guete'],
	areaOf: Map<string, number>
): Lage {
	const rng = random((seed >>> 0) * 7919 + 13),
		point = new Map(patch.vertices.map((v) => [v.id, v.point])),
		nb = new Map(patch.vertices.map((v) => [v.id, v.neighbors])),
		rand = new Set(patch.vertices.filter((v) => v.boundary).map((v) => v.id));
	const innen = new Map([...groups.values()].flat().map((id) => [id, true as const]));
	const all = patch.vertices.map((v) => v.point),
		extent = Math.max(...all.map((q) => Math.max(Math.abs(q[0]), Math.abs(q[1])))) * 1.1 + 4,
		weit = Math.max(...all.map((q) => Math.hypot(q[0], q[1])));
	const blocks: Block[] = [...groups]
		.sort((a, b) => (a[0] < b[0] ? -1 : 1))
		.map(([id, cells]) => {
			const b = block(id, cells.sort(), patch, point, innen, areaOf);
			return {
				...b,
				naehe: Math.max(0, 1 - Math.hypot(b.center[0], b.center[1]) / (weit * 1.05)),
				seed: (hash(id) ^ Math.floor(rng() * 4294967296)) >>> 0
			};
		});
	const blockOf = new Map<string, Block>();
	for (const b of blocks) for (const c of b.cells) blockOf.set(c, b);

	const umrisse = boundaryLoops(patch, point);

	// Railway: west flank of the convex hull, set 6 m outward.
	const hull = perimeterHull([...rand].map((v) => point.get(v)!)),
		h = hull.length,
		normal = (k: number): Point2 => {
			const a = hull[k],
				b = hull[(k + 1) % h],
				l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
			return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
		};
	const west = hull.map((_, k) => normal(k)[0] < -0.62);
	let start = west.findIndex((w, k) => w && !west[(k + h - 1) % h]);
	if (start < 0) start = 0;
	const bahn: Point2[] = [];
	for (let k = 0; k < h; k++) {
		const i = (start + k) % h;
		if (!west[i]) break;
		const nv = normal(i);
		if (!k) bahn.push([hull[i][0] + nv[0] * 6, hull[i][1] + nv[1] * 6]);
		const j = (i + 1) % h,
			nw = west[j] ? normal(j) : nv,
			m: Point2 = [nv[0] + nw[0], nv[1] + nw[1]],
			l = Math.hypot(m[0], m[1]) || 1;
		bahn.push([hull[j][0] + (m[0] / l) * 6, hull[j][1] + (m[1] / l) * 6]);
	}
	// Read the track from south to north.
	if (bahn.length > 1 && bahn[0][1] > bahn[bahn.length - 1][1]) bahn.reverse();
	const mitte: Point2 = bahn.length
		? [(bahn[0][0] + bahn[bahn.length - 1][0]) / 2, (bahn[0][1] + bahn[bahn.length - 1][1]) / 2]
		: [-extent, 0];
	const fern = (v: string) => Math.hypot(point.get(v)![0] - mitte[0], point.get(v)![1] - mitte[1]);
	const bahnsteig = patch.vertices
		.filter((v) => !v.boundary && !blockOf.has(v.id))
		.map((v) => v.id)
		.sort((a, b) => fern(a) - fern(b) || (a < b ? -1 : 1))
		.slice(0, 2);
	return {
		patch,
		blocks,
		blockOf,
		point,
		nb,
		rand,
		umrisse,
		bahn,
		bahnsteig,
		extent,
		guete
	};
}

/**
 * Crop around the center for the corner module lab (L10): all faces within radius `radius`,
 * as a patch of its own. The mesh is the same as in the world, only smaller.
 */
export function ausschnitt(p: LageParams, radius = 18): Patch {
	const l = lage(p),
		// Center: corner between the blocks near the origin, so that alley and perimeter block are in the frame.
		nah = (q: Point2) => Math.hypot(q[0], q[1]),
		polygons = l.patch.faces
			.filter((f) => f.vertices.every((v) => nah(l.point.get(v)!) <= radius))
			.map((f) => ({ id: f.id, vertices: [...f.vertices] }));
	return assemble(p.seed >>> 0, new Map(l.point), polygons);
}
