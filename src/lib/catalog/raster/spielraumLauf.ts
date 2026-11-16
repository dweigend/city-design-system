/**
 * Run of the leeway loop without DOM: fixed scene (carrier, shown corner, its leeway), state at a
 * clock time, dragging with a smoothed pointer, lag of the roofs, gliding back into the loop. Every
 * state passes through the core (`updatePatch`); what it rejects is not shown.
 * Units: meters and seconds.
 */
import {
	ablauf,
	netzBei,
	punkt,
	spielraum,
	traeger,
	ziehe,
	type Ablauf
} from '../logic/bibel/spielraum';
import { updatePatch, type UniversalPatch } from '../logic/parametrik/raster/universal';
import type { Point2 } from '../logic/parametrik/vocab';
import { haeuser } from './spielraumBild';

/** Duration of a phase in seconds. */
export const DAUER = 5.5;
/** Without motion each phase stands at this point: half warped, corner at the edge. */
export const STILL = 0.5;
/** Time constants in seconds. */
export const ZEIT = { glatt: 0.06, nachlauf: 0.16, zurueck: 0.65, entfalten: 0.4, welle: 0.8 };
/** Grab radius in CSS pixels per pointer type: finger generous, mouse precise. */
export const GREIFRADIUS: Readonly<Record<string, number>> = { touch: 30, pen: 20, mouse: 16 };

export const T = traeger(19);
export const GERADE = netzBei(T, 0);
const HALB = netzBei(T, 0.5);

/** Free corner that lies closest to a point. */
function naechste(patch: UniversalPatch, frei: readonly string[], p: Point2): string {
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

// Shown corner: near the center, but on no building, so its leeway stays freely visible.
const BEBAUT = haeuser(HALB);
export const START_ECKE = naechste(
	HALB,
	T.frei.filter((id) => !HALB.faces.some((f) => BEBAUT.has(f.id) && f.vertices.includes(id))),
	[0, 0]
);
export const P0 = punkt(HALB, START_ECKE);
/** Target of the corner in autoplay, deliberately beyond its leeway (meters). */
const WEG: Point2 = [9, 7];
export const RAUM_START = spielraum(HALB, START_ECKE, 48);
const wunschBei = (hin: number): Point2 => [P0[0] + WEG[0] * hin, P0[1] + WEG[1] * hin];

/** Share of phase 3 in which the corner hits the edge in autoplay. */
export const A_ANSCHLAG = (() => {
	for (let a = 0; a <= 0.6; a += 0.002)
		if (ziehe(HALB, START_ECKE, wunschBei(ablauf(2, a).hin)).amRand) return a;
	return 2;
})();

/** State of the loop for one point of the choreography. */
export function loopLage(z: Ablauf): { patch: UniversalPatch; amRand: boolean; wunsch?: Point2 } {
	if (z.hin <= 0) return { patch: z.verzug === 0.5 ? HALB : netzBei(T, z.verzug), amRand: false };
	const wunsch = wunschBei(z.hin);
	const r = ziehe(HALB, START_ECKE, wunsch);
	return { patch: updatePatch(HALB, new Map([[START_ECKE, r.punkt]])), amRand: r.amRand, wunsch };
}

/** Intermediate state while gliding back; if the core does not accept it, the target applies. */
export function mische(von: UniversalPatch, nach: UniversalPatch, k: number): UniversalPatch {
	if (k >= 1) return nach;
	const a = new Map(von.vertices.map((v) => [v.id, v.point]));
	const moved = new Map<string, Point2>();
	for (const id of T.frei) {
		const p = a.get(id),
			q = punkt(nach, id);
		if (p) moved.set(id, [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
	}
	try {
		return updatePatch(nach, moved);
	} catch {
		return nach;
	}
}

/** Grabbed corner. */
export type Hand = {
	/** State when grabbed; the leeway applies relative to its other corners. */
	basis: UniversalPatch;
	id: string;
	raum: Point2[];
	mitte: Point2;
	/** Where the pointer wants to go, smoothed toward it, and where the corner stands permitted. */
	ziel: Point2;
	glatt: Point2;
	punkt: Point2;
	amRand: boolean;
	/** Points in time (s): grabbed, last hit the edge. */
	seit: number;
	anschlag: number;
};

/** Grabs `id` in the visible state. The same corner again: its leeway depends only on the other corners and stays. */
export function greife(
	basis: UniversalPatch,
	id: string,
	alt: Hand | undefined,
	jetzt: number
): Hand {
	const p = punkt(basis, id);
	const vorher = alt?.id === id ? alt : undefined;
	return {
		basis,
		id,
		raum: vorher?.raum ?? spielraum(basis, id, 48),
		mitte: vorher?.mitte ?? p,
		ziel: p,
		glatt: p,
		punkt: p,
		amRand: false,
		seit: vorher?.seit ?? jetzt,
		anschlag: -9
	};
}

/** One time step of the hand: smooth the pointer, let the corner follow up to the edge. */
export function fuehre(
	h: Hand,
	dt: number,
	sofort: boolean,
	jetzt: number
): { hand: Hand; rest: number } {
	const f = sofort ? 1 : 1 - Math.exp(-dt / ZEIT.glatt);
	const g: Point2 = [
		h.glatt[0] + (h.ziel[0] - h.glatt[0]) * f,
		h.glatt[1] + (h.ziel[1] - h.glatt[1]) * f
	];
	const rest = Math.hypot(h.ziel[0] - g[0], h.ziel[1] - g[1]);
	if (Math.hypot(g[0] - h.glatt[0], g[1] - h.glatt[1]) <= 1e-5) return { hand: h, rest };
	const z = ziehe(h.basis, h.id, g);
	return {
		hand: {
			...h,
			glatt: rest < 1e-3 ? h.ziel : g,
			punkt: z.punkt,
			amRand: z.amRand,
			anschlag: z.amRand && !h.amRand ? jetzt : h.anschlag
		},
		rest
	};
}

/** Roofs follow the state with lag; `rest` is the largest remaining distance (m). */
export function nachlauf(
	dach: ReadonlyMap<string, Point2> | undefined,
	patch: UniversalPatch,
	dt: number
): { dach: Map<string, Point2>; rest: number } {
	const f = dt ? 1 - Math.exp(-dt / ZEIT.nachlauf) : 1;
	const neu = new Map<string, Point2>();
	let rest = 0;
	for (const v of patch.vertices) {
		const alt = dach?.get(v.id) ?? v.point;
		const q: Point2 = [alt[0] + (v.point[0] - alt[0]) * f, alt[1] + (v.point[1] - alt[1]) * f];
		rest = Math.max(rest, Math.abs(q[0] - v.point[0]) + Math.abs(q[1] - v.point[1]));
		neu.set(v.id, q);
	}
	return { dach: neu, rest };
}

/** Visible state with the grabbed corner. */
export const handLage = (h: Hand): UniversalPatch =>
	updatePatch(h.basis, new Map([[h.id, h.punkt]]));

/** Is something still running on the hand (unfolding of the zone, ripple)? */
export const bewegtSich = (h: Hand, jetzt: number) =>
	jetzt - h.seit < ZEIT.entfalten || jetzt - h.anschlag < ZEIT.welle;

/** Arrow keys: step of the selected corner in meters. */
export const PFEILE: Readonly<Record<string, Point2>> = {
	ArrowLeft: [-0.5, 0],
	ArrowRight: [0.5, 0],
	ArrowUp: [0, 0.5],
	ArrowDown: [0, -0.5]
};

/**
 * Free corner near an image point (CSS pixels), measured in the image, not in the model: this way a
 * finger grabs equally well, no matter how large the stage is.
 */
export function greifbar(
	patch: UniversalPatch,
	projiziere: (p: Point2) => { x: number; y: number },
	x: number,
	y: number,
	art: string
): string | undefined {
	let best: string | undefined,
		d = GREIFRADIUS[art] ?? GREIFRADIUS.mouse;
	for (const id of T.frei) {
		const q = projiziere(punkt(patch, id)),
			e = Math.hypot(q.x - x, q.y - y);
		if (e <= d) {
			d = e;
			best = id;
		}
	}
	return best;
}

/**
 * Two labels never on top of each other: if they are closer than `breite` × `hoehe` (CSS pixels),
 * both move apart by the same amount along their connection (otherwise vertically).
 */
export function auseinander<M extends { x: number; y: number }>(
	marken: M[],
	breite: number,
	hoehe: number
): M[] {
	if (marken.length < 2) return marken;
	const [a, b] = marken;
	const dx = b.x - a.x,
		dy = b.y - a.y;
	if (Math.abs(dx) >= breite || Math.abs(dy) >= hoehe) return marken;
	// Separating vertically is enough for text: half the missing height per mark, direction as before.
	const s = dy >= 0 ? 1 : -1,
		fehlt = (hoehe - Math.abs(dy)) / 2;
	return [{ ...a, y: a.y - s * fehlt }, { ...b, y: b.y + s * fehlt }, ...marken.slice(2)];
}
