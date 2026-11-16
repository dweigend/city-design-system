/**
 * Explainer loop "Every polygon becomes quads", headless. The subdivision itself comes unchanged
 * from the core (`toPatch`, without relaxation): set the center, halve the edges, connect.
 * `teilungsBild` describes the build-up as a pure function of the phase time u ∈ [0, 1).
 * Units: meters. No random numbers: the forms are fixed.
 */
import { cell } from '../parametrik/raster/geometry';
import { toPatch } from '../parametrik/raster/universal';
import type { Point2 } from '../parametrik/vocab';
import { muss } from './muss';

export type TeilformId = 'dreieck' | 'quadrat' | 'sechseck' | 'fuenfeck' | 'nachbarn';

const ring = (n: number, r: number, drehung = 0): Point2[] =>
	Array.from({ length: n }, (_, k) => {
		const a = drehung + (k * 2 * Math.PI) / n;
		return [r * Math.cos(a), r * Math.sin(a)];
	});

/** Neighbors: a hexagon with a square and a triangle on two edges, all edges 8 m. */
function nachbarn(): Point2[][] {
	const s = ring(6, 8);
	const aussen = (a: Point2, b: Point2): Point2 => {
		const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
		return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
	};
	// Square on edge s5–s0 (bottom right), triangle on edge s1–s2 (top).
	const [a, b] = [s[5], s[0]],
		n = aussen(a, b);
	const quadrat: Point2[] = [
		a,
		[a[0] + 8 * n[0], a[1] + 8 * n[1]],
		[b[0] + 8 * n[0], b[1] + 8 * n[1]],
		b
	];
	const [c, d] = [s[1], s[2]],
		m = aussen(c, d),
		h = 8 * (Math.sqrt(3) / 2);
	const dreieck: Point2[] = [c, [(c[0] + d[0]) / 2 + h * m[0], (c[1] + d[1]) / 2 + h * m[1]], d];
	// Center the group so that it sits in the same frame as the single forms.
	const alle = [s, quadrat, dreieck],
		xs = alle.flat().map((q) => q[0]),
		ys = alle.flat().map((q) => q[1]),
		mx = (Math.min(...xs) + Math.max(...xs)) / 2,
		my = (Math.min(...ys) + Math.max(...ys)) / 2;
	return alle.map((p) => p.map(([x, y]): Point2 => [x - mx, y - my]));
}

/** The forms of the loop in their order: one per phase. */
export const teilformen: { id: TeilformId; polygone: Point2[][] }[] = [
	{ id: 'dreieck', polygone: [ring(3, 10, Math.PI / 2)] },
	{ id: 'quadrat', polygone: [ring(4, 9.5, Math.PI / 4)] },
	{ id: 'sechseck', polygone: [ring(6, 9.5)] },
	{
		id: 'fuenfeck',
		polygone: [
			[
				[-8.5, -6],
				[6.5, -8],
				[10, 2.5],
				[1.5, 9.5],
				[-9, 4.5]
			]
		]
	},
	{ id: 'nachbarn', polygone: nachbarn() }
];

export type Teilung = {
	umrisse: Point2[][];
	/** Centers, one per polygon. */
	mitten: Point2[];
	/** Edge midpoints; `geteilt`: lies on an edge shared by two polygons. */
	kantenmitten: { p: Point2; geteilt: boolean }[];
	/** Spokes from a center to its edge midpoints. */
	speichen: [Point2, Point2][];
	vierecke: Point2[][];
};

/** Splits the polygons of a form into quads with the core (no relaxation). */
export function teile(polygone: Point2[][]): Teilung {
	const zellen = polygone.map((p, i) => cell(p, `z${i}`));
	const patch = toPatch(
		{
			kind: 'organic',
			cells: zellen,
			links: [],
			bounds: { min: [-20, -20], max: [20, 20] }
		},
		{ iterations: 0 }
	);
	const punkt = new Map(patch.vertices.map((v) => [v.id, v.point]));
	const mitten: Point2[] = [],
		kantenmitten: Teilung['kantenmitten'] = [],
		speichen: [Point2, Point2][] = [];
	const art = (id: string) => muss(patch.origins.get(id), id);
	const lage = (id: string) => muss(punkt.get(id), id);
	for (const v of patch.vertices) {
		const o = art(v.id);
		if (o.kind === 'center') mitten.push(v.point);
		if (o.kind === 'edge') kantenmitten.push({ p: v.point, geteilt: o.cells.length > 1 });
	}
	for (const f of patch.faces)
		for (const id of f.vertices)
			if (art(id).kind === 'center')
				for (const n of f.vertices) if (art(n).kind === 'edge') speichen.push([lage(id), lage(n)]);
	// Every spoke belongs to two quads: draw it once.
	const schluessel = (s: [Point2, Point2]) =>
		s
			.flat()
			.map((x) => x.toFixed(4))
			.join(',');
	const einmal = [...new Map(speichen.map((s) => [schluessel(s), s])).values()];
	return {
		umrisse: zellen.map((z) => z.polygon),
		mitten,
		kantenmitten,
		speichen: einmal,
		vierecke: patch.faces.map((f) => f.vertices.map(lage))
	};
}

/** Build-up of a phase: shares 0–1 per step. */
export type TeilungsBild = {
	/** Outline drawn (share of the length). */
	umriss: number;
	mitte: number;
	kantenmitten: number;
	/** Spokes grown from the center (share of the length). */
	speichen: number;
	/** Quads filled; afterwards they rise as a building plot. */
	vierecke: number;
	hub: number;
};

const schritt = (u: number, von: number, bis: number) => {
	const x = Math.max(0, Math.min(1, (u - von) / (bis - von)));
	return x * x * (3 - 2 * x);
};

/**
 * Schedule of a phase (u ∈ [0, 1)): outline, center, edge midpoints, spokes, quads, lift.
 * At the end everything sinks back so that the next outline starts on a blank sheet.
 */
export function teilungsBild(u: number): TeilungsBild {
	const aus = 1 - schritt(u, 0.92, 1);
	return {
		umriss: schritt(u, 0, 0.16) * aus,
		mitte: schritt(u, 0.16, 0.24) * aus,
		kantenmitten: schritt(u, 0.24, 0.36) * aus,
		speichen: schritt(u, 0.36, 0.56) * aus,
		vierecke: schritt(u, 0.56, 0.68) * aus,
		hub: schritt(u, 0.7, 0.8) * (1 - schritt(u, 0.86, 0.92))
	};
}
