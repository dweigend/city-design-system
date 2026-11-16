/**
 * Explainer loops for forms as pure functions of time t (seconds, ≥ 0). The scene
 * only queries; image and text follow from t, never from state. Meters, radians.
 */
import type { CornerMask } from '../parametrik/eck';
import { canonical } from '../parametrik/formen/eck';
import type { FunktionId } from '../parametrik/eckraster/funktion';
import type { Vec3 } from '../parametrik/types';
import type { Point2 } from '../parametrik/vocab';

/* ── Timeline ────────────────────────────────────────────── */

export type Takt = { index: number; u: number; runde: number };

/** Step and progress u ∈ [0, 1) at time t; the sequence repeats. */
export function takt(dauern: number[], t: number): Takt {
	const total = dauern.reduce((a, b) => a + b, 0);
	if (!(total > 0)) return { index: 0, u: 0, runde: 0 };
	const zeit = Math.max(0, Number.isFinite(t) ? t : 0);
	const runde = Math.floor(zeit / total);
	let rest = zeit - runde * total;
	for (let i = 0; i < dauern.length; i++) {
		if (rest < dauern[i]) return { index: i, u: rest / dauern[i], runde };
		rest -= dauern[i];
	}
	return { index: dauern.length - 1, u: 0, runde };
}

/** Start of step i in seconds (for step buttons). */
export const schrittBeginn = (dauern: number[], i: number) =>
	dauern.slice(0, Math.max(0, i)).reduce((a, b) => a + b, 0);

/** Ease in and out. */
export const weich = (u: number) => {
	const x = Math.max(0, Math.min(1, u));
	return x * x * (3 - 2 * x);
};

/* ── Loop 2: The corners choose the module ───────────────── */

export type EckSchritt = {
	id: string;
	mask: CornerMask;
	form: 'quadrat' | 'schief';
	dauer: number;
};

/** Step by step: corners fill, the module follows; then rotated and distorted. */
export const eckSchritte: EckSchritt[] = [
	{ id: 'ecke', mask: 0x01, form: 'quadrat', dauer: 2.8 },
	{ id: 'kante', mask: 0x03, form: 'quadrat', dauer: 2.4 },
	{ id: 'wand', mask: 0x33, form: 'quadrat', dauer: 2.4 },
	{ id: 'innenecke', mask: 0x77, form: 'quadrat', dauer: 2.4 },
	{ id: 'voll', mask: 0xff, form: 'quadrat', dauer: 2.6 },
	{ id: 'gedreht', mask: 0x66, form: 'quadrat', dauer: 3 },
	{ id: 'schief', mask: 0x66, form: 'schief', dauer: 3.2 }
];
export const eckDauern = eckSchritte.map((s) => s.dauer);

/** Corners are 0–3 at the bottom, 4–7 at the top (contract logic/parametrik/eck.ts). */
export const eckeGesetzt = (mask: CornerMask, ecke: number) => ((mask >> ecke) & 1) === 1;
export const eckeUmschalten = (mask: CornerMask, ecke: number): CornerMask =>
	(mask ^ (1 << ecke)) & 0xff;

/** Two masks are the same module if a rotation maps one onto the other. */
export const gleichesModul = (a: CornerMask, b: CornerMask) =>
	canonical(a).mask === canonical(b).mask;

/* ── Loop 3: One path through all levels ─────────────────── */

export type Ebene = { id: string; funktion: FunktionId; z: number; hoehe: number };

/** Program from bottom to top; level height 4 m. The garden is open. */
export const ebenen: Ebene[] = [
	{ id: 'markt', funktion: 'nahrung', z: 0, hoehe: 4 },
	{ id: 'werkstatt', funktion: 'material', z: 4, hoehe: 4 },
	{ id: 'wohnen', funktion: 'wohnen', z: 8, hoehe: 4 },
	{ id: 'lernen', funktion: 'tinte', z: 12, hoehe: 4 },
	{ id: 'garten', funktion: 'nahrung', z: 16, hoehe: 0.6 }
];

/** Tower and ramp: radius of the core, ramp outside, turns up to the garden. */
export const WEG = {
	kern: 5,
	innen: 5.6,
	aussen: 7.4,
	windungen: 2,
	hoehe: 16,
	/** Square: the person's starting point in meters. */
	platz: [-15, -6] as Point2,
	/** Angle at which the ramp starts on the ground (radians). */
	start: (-3 * Math.PI) / 4
} as const;

export const wegSchritte = [
	{ id: 'platz', dauer: 2.4 },
	...ebenen.map((e) => ({ id: e.id, dauer: e.id === 'garten' ? 3.2 : 2.2 }))
];
export const wegDauern = wegSchritte.map((s) => s.dauer);

/** Point on the ramp's center line at height z (0 … WEG.hoehe). */
export function rampenPunkt(z: number): Vec3 {
	const h = Math.max(0, Math.min(WEG.hoehe, z));
	const a = WEG.start + (h / WEG.hoehe) * WEG.windungen * Math.PI * 2;
	const r = (WEG.innen + WEG.aussen) / 2;
	return [Math.cos(a) * r, Math.sin(a) * r, h];
}

export type WegBild = {
	schritt: string;
	index: number;
	/** Levels the person has already reached (in color). */
	erreicht: number;
	/** Position of the person (foot point). */
	mensch: Vec3;
	/** Level whose name is currently shown in place, else null. */
	ebene: Ebene | null;
};

/** Person at time t: across the square to the ramp, then level by level up into the garden. */
export function wegLauf(t: number): WegBild {
	const { index, u } = takt(wegDauern, t);
	const id = wegSchritte[index].id;
	if (id === 'platz') {
		const [sx, sy] = WEG.platz,
			[ex, ey] = rampenPunkt(0);
		const s = weich(u);
		return {
			schritt: id,
			index,
			erreicht: 0,
			mensch: [sx + (ex - sx) * s, sy + (ey - sy) * s, 0],
			ebene: null
		};
	}
	const e = index - 1,
		ebene = ebenen[e];
	// First climb (up to the level), then stand in place; the level takes on color on arrival.
	const von = e === 0 ? 0 : ebenen[e - 1].z,
		bis = Math.min(ebene.z, WEG.hoehe);
	const s = weich(Math.min(1, u / 0.55));
	return {
		schritt: id,
		index,
		erreicht: s >= 1 ? e + 1 : e,
		mensch: rampenPunkt(von + (bis - von) * s),
		ebene: s >= 1 ? ebene : null
	};
}
