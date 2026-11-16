/**
 * Explainer loop "The mesh moves, the rules stay", headless.
 * A quad carrier with fixed topology (`toPatch` from 4 × 4 squares, boundary fixed) moves
 * between a straight and a distorted layout. The core checks every move itself (`updatePatch`):
 * a corner may go anywhere as long as no adjacent quad becomes more acute than the limit.
 * Units: meters, angles in degrees (display). Deterministic per seed.
 */
import { random } from '../parametrik/random';
import { cell } from '../parametrik/raster/geometry';
import { quality, toPatch, updatePatch, type UniversalPatch } from '../parametrik/raster/universal';
import type { Point2 } from '../parametrik/vocab';
import { muss } from './muss';

/** Smallest angle the core allows during a move (update.ts), in degrees. */
export const GRENZWINKEL = 5;

export type Traeger = {
	/** Straight layout: 8 × 8 quads of 5 m each, center at the origin. */
	basis: UniversalPatch;
	/** Distorted layout of the same corners (same IDs). */
	ziel: Map<string, Point2>;
	/** Movable corners (not on the boundary), sorted. */
	frei: string[];
};

/** Quad carrier and its distorted layout from a seed. */
export function traeger(saat: number): Traeger {
	const cells = [];
	for (let j = 0; j < 4; j++)
		for (let i = 0; i < 4; i++) {
			const x = i * 10 - 20,
				y = j * 10 - 20;
			cells.push(
				cell(
					[
						[x, y],
						[x + 10, y],
						[x + 10, y + 10],
						[x, y + 10]
					],
					`q${j}${i}`
				)
			);
		}
	const basis = toPatch(
		{ kind: 'quad-irregular', cells, links: [], bounds: { min: [-20, -20], max: [20, 20] } },
		{ iterations: 0 }
	);
	const rng = random((saat >>> 0) * 2654435761 + 17);
	const p1 = rng() * Math.PI * 2,
		p2 = rng() * Math.PI * 2,
		drall = (rng() < 0.5 ? -1 : 1) * 0.42;
	const frei = basis.vertices
		.filter((v) => !muss(basis.origins.get(v.id), v.id).fixed)
		.map((v) => v.id)
		.sort();
	const ziel = new Map<string, Point2>();
	for (const v of basis.vertices) {
		const [x, y] = v.point;
		if (muss(basis.origins.get(v.id), v.id).fixed) {
			ziel.set(v.id, [x, y]);
			continue;
		}
		// Strong inside, zero toward the fixed boundary: a swirl around the center plus two waves.
		const innen = Math.min(20 - Math.abs(x), 20 - Math.abs(y)) / 20,
			a = drall * innen ** 1.2,
			rx = x * Math.cos(a) - y * Math.sin(a),
			ry = x * Math.sin(a) + y * Math.cos(a);
		ziel.set(v.id, [
			rx + 2.6 * innen * Math.sin(y / 6 + p1),
			ry + 2.6 * innen * Math.sin(x / 7 + p2)
		]);
	}
	return { basis, ziel, frei };
}

/** Layout at t ∈ [0, 1] as a checked patch: the core accepts the whole move or throws. */
export function netzBei(t: Traeger, s: number): UniversalPatch {
	const moved = new Map<string, Point2>();
	for (const id of t.frei) {
		const a = punkt(t.basis, id),
			b = muss(t.ziel.get(id), id);
		moved.set(id, [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]);
	}
	return updatePatch(t.basis, moved);
}

/** Does the core accept corner `id` at position `p`? */
export function zulaessig(patch: UniversalPatch, id: string, p: Point2): boolean {
	try {
		updatePatch(patch, new Map([[id, p]]));
		return true;
	} catch {
		return false;
	}
}

/** Position of a corner in the patch. */
export const punkt = (patch: UniversalPatch, id: string): Point2 =>
	muss(
		patch.vertices.find((v) => v.id === id),
		`corner ${id}`
	).point;

/**
 * Drags corner `id` toward `ziel`. If the target is too far, it stops at the last valid
 * position along the way (bisection, 14 steps ≈ 0.1 mm over 1 m of travel).
 */
export function ziehe(
	patch: UniversalPatch,
	id: string,
	ziel: Point2
): { punkt: Point2; amRand: boolean } {
	if (zulaessig(patch, id, ziel)) return { punkt: ziel, amRand: false };
	const a = punkt(patch, id);
	let lo = 0,
		hi = 1;
	for (let k = 0; k < 14; k++) {
		const m = (lo + hi) / 2;
		if (zulaessig(patch, id, [a[0] + (ziel[0] - a[0]) * m, a[1] + (ziel[1] - a[1]) * m])) lo = m;
		else hi = m;
	}
	return { punkt: [a[0] + (ziel[0] - a[0]) * lo, a[1] + (ziel[1] - a[1]) * lo], amRand: true };
}

/**
 * Leeway of the corner: measured from its position along `richtungen` rays up to the last
 * valid position. Yields a star-shaped polygon around the corner.
 */
export function spielraum(patch: UniversalPatch, id: string, richtungen = 72): Point2[] {
	const a = punkt(patch, id),
		weit = 30;
	return Array.from({ length: richtungen }, (_, k) => {
		const w = (k / richtungen) * Math.PI * 2;
		return ziehe(patch, id, [a[0] + weit * Math.cos(w), a[1] + weit * Math.sin(w)]).punkt;
	});
}

/** An interior angle in the mesh: apex, the two neighboring corners (counterclockwise from `c` to `a`) and degrees. */
export type Winkelstelle = { scheitel: Point2; a: Point2; c: Point2; grad: number };

/**
 * Angle range (degrees) and largest aspect ratio of the quads at a corner, plus where the most
 * acute and the widest angle sit. The core keeps every quad convex (every angle below 180°)
 * and no angle below `GRENZWINKEL`.
 */
export function messe(
	patch: UniversalPatch,
	id: string
): {
	kleinster: number;
	groesster: number;
	seiten: number;
	spitz: Winkelstelle;
	weit: Winkelstelle;
} {
	const p = new Map(patch.vertices.map((v) => [v.id, v.point]));
	const flaechen = patch.faces
		.filter((f) => f.vertices.includes(id))
		.map((f) => f.vertices.map((v) => muss(p.get(v), v)));
	let spitz: Winkelstelle | undefined, weit: Winkelstelle | undefined;
	for (const q of flaechen)
		q.forEach((b, i) => {
			const a = q[(i + 3) % 4],
				c = q[(i + 1) % 4];
			const u = [a[0] - b[0], a[1] - b[1]],
				v = [c[0] - b[0], c[1] - b[1]];
			// Counterclockwise: v × u > 0 means a convex corner.
			const w = Math.atan2(v[0] * u[1] - v[1] * u[0], v[0] * u[0] + v[1] * u[1]);
			const grad = (w < 0 ? 2 * Math.PI + w : w) * (180 / Math.PI);
			const stelle = { scheitel: b, a, c, grad };
			if (!spitz || grad < spitz.grad) spitz = stelle;
			if (!weit || grad > weit.grad) weit = stelle;
		});
	const s = muss(spitz, `angle at ${id}`),
		g = muss(weit, `angle at ${id}`);
	return {
		kleinster: s.grad,
		groesster: g.grad,
		seiten: quality(flaechen).maxAspect,
		spitz: s,
		weit: g
	};
}

const sanft = (x: number) => {
	const k = Math.max(0, Math.min(1, x));
	return k * k * (3 - 2 * k);
};
/** Ease in from `von`, ease out from `bis`, each over `rampe` (shares of the phase). */
const fenster = (a: number, von: number, bis: number, rampe: number) =>
	sanft((a - von) / rampe) * (1 - sanft((a - bis) / rampe));

/** State of the choreography in a phase; all quantities 0 to 1. */
export type Ablauf = {
	/** Distortion of the mesh (0 straight, 1 fully distorted), input for `netzBei`. */
	verzug: number;
	/** Visibility of the straight initial mesh as a ghost. */
	geist: number;
	/** Highlight of the building and its neighbors. */
	nachbarn: number;
	/** Travel of the shown corner toward a target beyond its leeway. */
	hin: number;
	/** Unfolding of the leeway zone. */
	raum: number;
};

/**
 * Choreography of the loop as a pure function of phase and share. Transitions are continuous:
 * every phase ends at the distortion the next one begins with (0 → 1 → ½ → 0); corner and zone
 * are back before the mesh relaxes again. The zone applies only at distortion ½ and appears only there.
 */
export function ablauf(phase: number, a: number): Ablauf {
	if (phase === 0)
		return { verzug: sanft(a), geist: fenster(a, 0, 0.82, 0.18), nachbarn: 0, hin: 0, raum: 0 };
	if (phase === 1)
		return {
			verzug: 1 - 0.5 * sanft(a),
			geist: 0,
			nachbarn: fenster(a, 0, 0.85, 0.15),
			hin: 0,
			raum: 0
		};
	return {
		verzug: 0.5 * (1 - sanft((a - 0.8) / 0.2)),
		geist: 0,
		nachbarn: 0,
		hin: fenster(a, 0.06, 0.56, 0.22),
		raum: fenster(a, 0, 0.66, 0.12)
	};
}

/** Free corner nearest to a point (for pointer and touch). */
export function naechsteEcke(patch: UniversalPatch, frei: readonly string[], p: Point2): string {
	let best = frei[0],
		d = Infinity;
	for (const id of frei) {
		const q = punkt(patch, id),
			e = Math.hypot(q[0] - p[0], q[1] - p[1]);
		if (e < d) {
			d = e;
			best = id;
		}
	}
	return best;
}
