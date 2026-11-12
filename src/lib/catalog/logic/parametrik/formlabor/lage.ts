/**
 * Position layer: the deformation of the carrier. The carrier (slots, ids, rest dimensions) stays fixed;
 * only its embedding in space moves (101 §2, “fixed carrier, moving position layer”).
 * Four operators in fixed order: round → profile → twist → bend.
 * The same computation runs in the shader (scene/formlabor.ts); here only for ports and tests.
 * Coordinates: x/y plan, z height, tower axis at the origin.
 */
import type { Vec3 } from '../types';
import { clamp } from './hash';

export type Lage = {
	/** Tower height in meters (reference for all operators). */
	hoehe: number;
	/** 0 = square plan, 1 = circle (concentric squares become circles). */
	rund: number;
	/** > 0 tapers toward the top, < 0 cantilevers outward toward the top. */
	verjuengung: number;
	/** > 0 belly (barrel, onion), < 0 waist (hyperboloid, catenoid). */
	bauch: number;
	/** Twist of the top relative to the foot in radians. */
	drall: number;
	/** Curvature of the axis: angle of the top in radians. */
	biegung: number;
	/** Direction of the bend in plan in radians. */
	richtung: number;
};

export const ruhe = (hoehe: number): Lage => ({
	hoehe,
	rund: 0,
	verjuengung: 0,
	bauch: 0,
	drall: 0,
	biegung: 0,
	richtung: 0
});

/** Radial scale at height w = z / hoehe. */
export function profil(w: number, l: Lage): number {
	const c = clamp(w);
	return Math.max(0.12, (1 - l.verjuengung * c) * (1 + l.bauch * Math.sin(Math.PI * c)));
}

const sinc = (x: number) => (Math.abs(x) < 1e-4 ? 1 : Math.sin(x) / x);

export function verformen([x, y, z]: Vec3, l: Lage): Vec3 {
	const w = z / l.hoehe;
	// 1 Round
	const m = Math.max(Math.abs(x), Math.abs(y)),
		len = Math.hypot(x, y);
	const r = len > 1e-6 ? 1 + (m / len - 1) * l.rund : 1;
	// 2 Profile
	const s = r * profil(w, l);
	x *= s;
	y *= s;
	// 3 Twist
	const a = l.drall * clamp(w, -0.2, 1.4),
		ca = Math.cos(a),
		sa = Math.sin(a);
	[x, y] = [x * ca - y * sa, x * sa + y * ca];
	// 4 Bend (Barr): the axis becomes a circular arc. Written without 1 / k, stable down to k = 0.
	const k = l.biegung / l.hoehe,
		t = k * z,
		cr = Math.cos(l.richtung),
		sr = Math.sin(l.richtung),
		u = x * cr + y * sr,
		v = -x * sr + y * cr,
		u2 = u * Math.cos(t) + z * sinc(t / 2) * Math.sin(t / 2);
	z = z * sinc(t) - u * Math.sin(t);
	x = u2 * cr - v * sr;
	y = u2 * sr + v * cr;
	return [x, y, z];
}
