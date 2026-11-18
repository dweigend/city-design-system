/**
 * Instance buffer: one component = one row of 28 numbers. The scene uploads the rows
 * unchanged as instance attributes; geometry is never rebuilt.
 * Pure data, without three.js.
 */
import type { Vec3 } from '../types';
import type { Form } from './urform';

export const SCHRITT = 28;

/** Field offsets within a row (also the contract for the scene's attributes). */
export const FELD = {
	ort: 0, // 3  center at rest (x, y, z)
	drehung: 3, // 4  Quaternion (x, y, z, w)
	halb: 7, // 3  half dimensions
	rxy: 10, // 1  rounding in plan
	rt: 11, // 1  rounding at top
	rb: 12, // 1  rounding at bottom
	tx: 13, // 1  taper at top in x
	ty: 14, // 1  taper at top in y
	farbe: 15, // 3  sRGB
	traeger: 18, // 1  0 = stays put (existing stock) · 1 = follows the position layer · 2 = follows, rounds itself
	muster: 19, // 1  pattern id
	staerke: 20, // 1  pattern strength 0–1
	glanz: 21, // 1  0 matte · 1 satin · 2 gloss
	deckkraft: 22, // 1  skins only
	phase: 23, // 1  construction phase
	folge: 24, // 1  order within the phase 0–1
	explR: 25, // 1  explosion: > 0 radial, < 0 sideways as a whole (meters)
	explZ: 26, // 1  vertical explosion in meters
	id: 27 // 1  fixed slot id
} as const;

/** Construction phases after reference 134: existing stock stands, then frame → core → modules → networks → crown. */
export const PHASE = { bestand: 0, rahmen: 1, kern: 2, modul: 3, netz: 4, kopf: 5 } as const;
export const phasen = ['Existing stock', 'Frame', 'Core', 'Modules', 'Networks', 'Crown'] as const;

/** Pattern ids (shader: scene/formlabor.ts). */
export const MUSTER = {
	keins: 0,
	streifen: 1,
	baender: 2,
	punkte: 3,
	raster: 4,
	schach: 5,
	diagonal: 6,
	fenster: 7,
	dreieck: 8,
	terrazzo: 9,
	zickzack: 10,
	bullauge: 11,
	tor: 12
} as const;

export type Puffer = { daten: Float32Array; anzahl: number; platz: number };
export const puffer = (platz: number): Puffer => ({
	daten: new Float32Array(platz * SCHRITT),
	anzahl: 0,
	platz
});

export type Quat = [number, number, number, number];
const EINS: Quat = [0, 0, 0, 1];
/** Rotation about the vertical axis. */
export const umZ = (a: number): Quat => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
export function mal(a: Quat, b: Quat): Quat {
	return [
		a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
		a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
		a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
		a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
	];
}
/** Shortest rotation that aligns the vertical axis with direction d (for rods and pipes). */
export function entlang(d: Vec3): Quat {
	const len = Math.hypot(d[0], d[1], d[2]) || 1,
		x = d[0] / len,
		y = d[1] / len,
		z = d[2] / len;
	if (z < -0.99999) return [1, 0, 0, 0];
	const w = 1 + z,
		n = Math.hypot(-y, x, w) || 1;
	return [-y / n, x / n, 0, w / n];
}

export type Teil = {
	id: number;
	ort: Vec3;
	form: Form;
	farbe: Vec3;
	drehung?: Quat;
	/** 0–1: the component grows from its center (soft presence). */
	da?: number;
	traeger?: number;
	muster?: number;
	staerke?: number;
	glanz?: number;
	deckkraft?: number;
	phase?: number;
	folge?: number;
	explR?: number;
	explZ?: number;
};

/** Writes one component. Anything absent (da ≈ 0) occupies no row. */
export function setze(p: Puffer, t: Teil): boolean {
	const da = t.da ?? 1;
	if (da < 0.004 || p.anzahl >= p.platz) return false;
	const d = p.daten,
		o = p.anzahl * SCHRITT,
		f = t.form,
		q = t.drehung ?? EINS;
	const hx = Math.max(0.005, f.hx * da),
		hy = Math.max(0.005, f.hy * da),
		hz = Math.max(0.005, f.hz * da);
	// Primal form validity: plan rounding ≤ smallest half-width, edge rounding ≤ plan rounding.
	const rxy = Math.max(0, Math.min(f.rxy * da, hx, hy));
	let rt = Math.max(0, Math.min(f.rt * da, rxy)),
		rb = Math.max(0, Math.min(f.rb * da, rxy));
	const sum = rt + rb;
	if (sum > 2 * hz) {
		rt *= (2 * hz) / sum;
		rb *= (2 * hz) / sum;
	}
	d[o] = t.ort[0];
	d[o + 1] = t.ort[1];
	d[o + 2] = t.ort[2];
	d[o + 3] = q[0];
	d[o + 4] = q[1];
	d[o + 5] = q[2];
	d[o + 6] = q[3];
	d[o + 7] = hx;
	d[o + 8] = hy;
	d[o + 9] = hz;
	d[o + 10] = rxy;
	d[o + 11] = rt;
	d[o + 12] = rb;
	d[o + 13] = f.tx;
	d[o + 14] = f.ty;
	d[o + 15] = t.farbe[0];
	d[o + 16] = t.farbe[1];
	d[o + 17] = t.farbe[2];
	d[o + 18] = t.traeger ?? 1;
	d[o + 19] = t.muster ?? 0;
	d[o + 20] = t.staerke ?? 0;
	d[o + 21] = t.glanz ?? 0;
	d[o + 22] = t.deckkraft ?? 1;
	d[o + 23] = t.phase ?? 0;
	d[o + 24] = t.folge ?? 0;
	d[o + 25] = t.explR ?? 0;
	d[o + 26] = t.explZ ?? 0;
	d[o + 27] = t.id;
	p.anzahl++;
	return true;
}
