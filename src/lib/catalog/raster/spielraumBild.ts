/**
 * Drawing rule of the leeway loop: translates a fully computed scene into lines,
 * surfaces and points of the stage. Presentation only (token, stroke weight, height), no DOM, no three.js.
 *
 * Visual language: mesh in blueprint, existing stock gray. The leeway is a zone in signal color with
 * a light core, a denser edge band, fine measuring rays (this is how it is measured) and a clear edge.
 * Angles sit as wedge and arc directly at the vertex; at their limit they turn signal.
 */
import type { Bild, Flaeche, Kreis, Linien } from '../scene/rasterBuehne';
import type { Point2 } from '../logic/parametrik/vocab';
import type { UniversalPatch } from '../logic/parametrik/raster/universal';
import { muss } from '../logic/bibel/muss';
import { GRENZWINKEL, type Winkelstelle } from '../logic/bibel/spielraum';
import { kanten } from './bilder';

/** Scene of the leeway loop: everything an image needs, already fully computed. */
export type SpielraumSzene = {
	patch: UniversalPatch;
	frei: readonly string[];
	/** Shown (grabbed) corner. */
	ecke: string;
	/** Roofs lagging behind: corner positions the building roofs follow. */
	dach?: ReadonlyMap<string, Point2>;
	/** Straight starting mesh as a ghost, strength 0 to 1. */
	geist?: { patch: UniversalPatch; staerke: number };
	/** Highlight of building and neighbors, 0 to 1. */
	nachbarn: number;
	/** Leeway of the corner: outline, center (starting position) and unfolding 0 to 1. */
	raum?: { polygon: Point2[]; mitte: Point2; staerke: number };
	amRand: boolean;
	/** Where the corner wanted to go when its leeway stops it. */
	wunsch?: Point2;
	/** Ripple at the stop, age 0 to 1. */
	welle?: number;
	/** Angle arcs at the sharpest and widest point, strength 0 to 1. */
	winkel?: { stellen: Winkelstelle[]; staerke: number };
	/** Corner under the pointer. */
	hover?: string;
};

/** Buildings of the loop: every seventh quad, height from the order, without randomness. */
export function haeuser(patch: { faces: { id: string }[] }): Map<string, number> {
	return new Map(
		patch.faces.flatMap((f, i) => (i % 7 === 3 ? [[f.id, 3 + ((i * 5) % 4) * 1.5] as const] : []))
	);
}

const kreisZug = (m: Point2, r: number, n = 40): Point2[] =>
	Array.from({ length: n }, (_, k) => {
		const w = (k / n) * Math.PI * 2;
		return [m[0] + r * Math.cos(w), m[1] + r * Math.sin(w)];
	});
const richtung = (von: Point2, nach: Point2) => Math.atan2(nach[1] - von[1], nach[0] - von[0]);
const abstand = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Arc of an interior angle: from the edge to `c` counterclockwise to the edge to `a`. */
export function winkelBogen(s: Winkelstelle, r: number, n = 18): Point2[] {
	const w0 = richtung(s.scheitel, s.c),
		w = (s.grad * Math.PI) / 180;
	return Array.from({ length: n + 1 }, (_, k) => {
		const t = w0 + (w * k) / n;
		return [s.scheitel[0] + r * Math.cos(t), s.scheitel[1] + r * Math.sin(t)];
	});
}

/** Point on the angle bisector at distance `r` (anchor for the label). */
export function winkelAnker(s: Winkelstelle, r: number): Point2 {
	const t = richtung(s.scheitel, s.c) + (s.grad * Math.PI) / 360;
	return [s.scheitel[0] + r * Math.cos(t), s.scheitel[1] + r * Math.sin(t)];
}

/**
 * Degrees for reading. The core permits only angles under 180°; a value just below is therefore called
 * “≈180°”, never “180°”.
 */
export const gradText = (grad: number) => (grad >= 179.5 ? '≈180°' : `${Math.round(grad)}°`);

/** Is the angle at its limit (5° or 180°)? */
export const anGrenze = (s: Winkelstelle) => s.grad < GRENZWINKEL + 1 || s.grad > 179;

/** Radius of the angle arcs in meters: just under half the shorter leg length. */
export const bogenRadius = (s: Winkelstelle) =>
	Math.min(3, 0.5 * Math.min(abstand(s.a, s.scheitel), abstand(s.c, s.scheitel)));

type Teile = { linien: Linien[]; flaechen: Flaeche[]; kreise: Kreis[] };
type Lage = (id: string) => Point2;

function geist(sz: SpielraumSzene, out: Teile) {
	if (!sz.geist || sz.geist.staerke <= 0.01) return;
	const g = new Map(sz.geist.patch.vertices.map((v) => [v.id, v.point]));
	out.linien.push({
		key: 'geist',
		strecken: kanten(sz.geist.patch.faces.map((f) => f.vertices.map((v) => muss(g.get(v), v)))),
		token: '--ink-3',
		px: 1,
		papier: 1 - 0.8 * sz.geist.staerke,
		z: 0.02
	});
}

/** Mesh, buildings on their quads (roof with lag), one building with neighbors highlighted. */
function netzUndHaeuser(sz: SpielraumSzene, lage: Lage, out: Teile) {
	const viereck = (f: { vertices: string[] }) => f.vertices.map(lage);
	const hoehe = haeuser(sz.patch);
	const bebaut = sz.patch.faces.filter((f) => hoehe.has(f.id));
	const haus = bebaut[Math.floor(bebaut.length / 2)];
	const nb = sz.nachbarn;
	out.linien.push({
		key: 'netz',
		strecken: kanten(sz.patch.faces.map(viereck)),
		token: '--blueprint',
		px: 1
	});
	if (nb > 0.01) {
		const umfeld = sz.patch.faces.filter(
			(f) => f.id !== haus.id && f.vertices.filter((v) => haus.vertices.includes(v)).length === 2
		);
		out.linien.push({
			key: 'umfeld',
			strecken: kanten([haus, ...umfeld].map(viereck)),
			token: '--ink',
			px: 1.6,
			papier: 1 - nb
		});
		for (const f of umfeld)
			out.flaechen.push({
				polygon: viereck(f),
				token: '--blueprint',
				papier: 1 - 0.18 * nb,
				z: 0.03
			});
	}
	for (const f of bebaut) {
		const markiert = f.id === haus.id && nb > 0;
		out.flaechen.push({
			polygon: viereck(f),
			oben: sz.dach ? f.vertices.map((v) => sz.dach?.get(v) ?? lage(v)) : undefined,
			token: markiert ? '--cat-living' : '--paper-3',
			papier: markiert ? 1 - 0.55 * nb : 0,
			hoehe: hoehe.get(f.id),
			z: 0.05
		});
	}
}

/** Leeway as a zone: unfolds from the corner, light core, denser edge band, clear edge. */
function zone(sz: SpielraumSzene, out: Teile) {
	if (!sz.raum || sz.raum.staerke <= 0.01) return;
	const { mitte, staerke } = sz.raum;
	const zu = (q: Point2, k: number): Point2 => [
		mitte[0] + (q[0] - mitte[0]) * k,
		mitte[1] + (q[1] - mitte[1]) * k
	];
	const aussen = sz.raum.polygon.map((q) => zu(q, staerke));
	const innen = aussen.map((q) => zu(q, 0.84));
	const blass = 1 - staerke;
	out.flaechen.push(
		{ polygon: innen, token: '--signal', papier: 0.9 + 0.1 * blass, z: 0.035 },
		{
			polygon: aussen,
			loecher: [innen.slice().reverse()],
			token: '--signal',
			papier: 0.74 + 0.26 * blass,
			z: 0.036
		}
	);
	out.linien.push(
		{
			key: 'strahlen',
			strecken: aussen
				.filter((_, k) => k % 2 === 0)
				.flatMap((q) => [mitte[0], mitte[1], q[0], q[1]]),
			token: '--signal',
			px: 0.75,
			papier: 0.78 + 0.22 * blass,
			z: 0.04
		},
		{ key: 'raum', strecken: kanten([aussen]), token: '--signal', px: 1.5, papier: blass, z: 0.06 }
	);
}

/** Wedge and arc directly at the point that is currently tightest or widest. */
function winkel(sz: SpielraumSzene, out: Teile) {
	if (!sz.winkel || sz.winkel.staerke <= 0.01) return;
	const blass = 1 - sz.winkel.staerke;
	sz.winkel.stellen.forEach((s, i) => {
		const bogen = winkelBogen(s, bogenRadius(s)),
			grenze = anGrenze(s);
		out.flaechen.push({
			polygon: [s.scheitel, ...bogen],
			token: grenze ? '--signal' : '--blueprint',
			papier: grenze ? 0.55 + 0.45 * blass : 0.78 + 0.22 * blass,
			z: 0.07
		});
		const zug: number[] = [];
		for (let k = 0; k + 1 < bogen.length; k++)
			zug.push(bogen[k][0], bogen[k][1], bogen[k + 1][0], bogen[k + 1][1]);
		out.linien.push({
			key: `bogen${i}`,
			strecken: zug,
			token: grenze ? '--signal' : '--ink',
			px: 1.5,
			papier: blass,
			z: 0.09
		});
	});
}

/** Wish and stop: thin leash to the target beyond the edge, ripple at the corner. */
function anschlag(sz: SpielraumSzene, p: Point2, out: Teile) {
	const w = sz.wunsch;
	if (sz.amRand && w && abstand(w, p) > 0.3)
		out.linien.push(
			{
				key: 'leine',
				strecken: [p[0], p[1], w[0], w[1]],
				token: '--signal',
				px: 1,
				papier: 0.45,
				z: 0.1
			},
			{
				key: 'wunsch',
				strecken: kanten([kreisZug(w, 0.55, 24)]),
				token: '--signal',
				px: 1.2,
				papier: 0.35,
				z: 0.1
			}
		);
	const k = sz.welle;
	if (k !== undefined && k >= 0 && k < 1)
		out.linien.push({
			key: 'welle',
			strecken: kanten([kreisZug(p, 0.6 + 2.4 * (1 - (1 - k) ** 3))]),
			token: '--signal',
			px: 1.5,
			papier: 0.15 + 0.85 * k,
			z: 0.1
		});
}

/** Corners as points; the shown one as a ring, filled at the edge; the one under the pointer larger. */
function ecken(sz: SpielraumSzene, lage: Lage, p: Point2, out: Teile) {
	for (const id of sz.frei) {
		if (id === sz.ecke) continue;
		const h = id === sz.hover;
		out.kreise.push({ p: lage(id), token: h ? '--ink' : '--ink-2', px: h ? 10 : 5 });
		if (h) out.kreise.push({ p: lage(id), token: '--paper', px: 5, z: 0.11 });
	}
	out.kreise.push(
		{ p, token: sz.amRand ? '--signal' : '--ink', px: 13, z: 0.3 },
		{ p, token: '--paper', px: sz.amRand ? 0 : 6, z: 0.31 }
	);
}

/** Explainer loop leeway: the whole image from one scene. */
export function spielraumBild(sz: SpielraumSzene): Bild {
	const punkt = new Map(sz.patch.vertices.map((v) => [v.id, v.point]));
	const lage: Lage = (id) => muss(punkt.get(id), id);
	const p = lage(sz.ecke);
	const out: Teile = { linien: [], flaechen: [], kreise: [] };
	geist(sz, out);
	zone(sz, out);
	netzUndHaeuser(sz, lage, out);
	winkel(sz, out);
	anschlag(sz, p, out);
	ecken(sz, lage, p, out);
	return out;
}
