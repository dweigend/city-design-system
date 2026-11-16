/**
 * Portholes on spheres: round windows, generatively distributed (sphere house, Futuro aesthetic).
 *
 * Rules, in this order:
 * 1. Windows lie entirely in the living band above the belly band (latitude 12° … 50°): there one
 *    stands upright, and no frame cuts the band.
 * 2. They seek the light: the acceptance probability rises toward the sunny side (south).
 * 3. No window touches another (minimum distance on the sphere, sagitta included).
 * 4. Windows that would lie inside a neighboring sphere are dropped.
 * 5. Some windows get a twin at the same height (pairs as in the precedent).
 * Its own random stream from the seed: the stream of the form kit stays untouched.
 * Pure, without three.js. Angles in radians, lengths in meters, local coordinates (u, v, z).
 */
import { random } from '../random';
import type { Vec3 } from '../types';

export type Kugel = { center: Vec3; radius: number };
export type Bullauge = {
	kugel: number;
	/** Direction in plan (local, counterclockwise from +u). */
	azimut: number;
	/** Height above the equator. */
	breite: number;
	/** Outer radius of the frame in meters. */
	radius: number;
	/** Center on the sphere surface. */
	position: Vec3;
};

export const WOHNBAND: [number, number] = [(12 * Math.PI) / 180, (50 * Math.PI) / 180];
/** Size classes as a share of the sphere radius: living room, bedroom, bathroom. */
const GROESSEN = [0.26, 0.19, 0.13];
/** Clear distance between two frames as a share of the sphere radius. */
const FUGE = 0.05;
const STROM = 0x6b756c6c; // own random stream "bull"

const punkt = (k: Kugel, azimut: number, breite: number): Vec3 => [
	k.center[0] + k.radius * Math.cos(breite) * Math.cos(azimut),
	k.center[1] + k.radius * Math.cos(breite) * Math.sin(azimut),
	k.center[2] + k.radius * Math.sin(breite)
];

/** Angular distance between two directions on the sphere (radians). */
function winkel(a: Bullauge, b: Bullauge) {
	const c =
		Math.sin(a.breite) * Math.sin(b.breite) +
		Math.cos(a.breite) * Math.cos(b.breite) * Math.cos(a.azimut - b.azimut);
	return Math.acos(Math.max(-1, Math.min(1, c)));
}

/**
 * Distributes up to `anzahl` portholes per sphere. `sonne`: direction of the sunny side in the local
 * plan (radians). The same inputs return the same list in the same order.
 */
export function bullaugen(
	kugeln: Kugel[],
	anzahl: number,
	saat: number,
	sonne: number
): Bullauge[] {
	const rng = random((saat ^ STROM) >>> 0);
	const out: Bullauge[] = [];
	const n = Math.max(0, Math.round(anzahl));
	kugeln.forEach((k, index) => {
		const eigene: Bullauge[] = [];
		const frei = (b: Bullauge) => {
			for (const o of eigene)
				if (winkel(o, b) * k.radius < o.radius + b.radius + FUGE * k.radius) return false;
			// Rule 4: the center may lie in no other sphere (with the frame as buffer).
			return kugeln.every(
				(m, j) =>
					j === index ||
					Math.hypot(
						b.position[0] - m.center[0],
						b.position[1] - m.center[1],
						b.position[2] - m.center[2]
					) >
						m.radius + b.radius
			);
		};
		const neu = (azimut: number, breite: number, radius: number): Bullauge => ({
			kugel: index,
			azimut,
			breite,
			radius,
			position: punkt(k, azimut, breite)
		});
		for (let versuch = 0; versuch < n * 40 && eigene.length < n; versuch++) {
			const azimut = rng() * Math.PI * 2;
			const groesse = eigene.length === 0 ? GROESSEN[0] : GROESSEN[Math.floor(rng() * 3) % 3];
			// Rule 1: the lower frame edge stays above the band boundary.
			const lo = WOHNBAND[0] + Math.asin(Math.min(1, groesse)),
				hi = WOHNBAND[1];
			// Uniform over the area: sin(latitude) uniform within the band.
			const breite = Math.asin(Math.sin(lo) + rng() * (Math.sin(hi) - Math.sin(lo)));
			const licht = 0.25 + 0.75 * Math.max(0, Math.cos(azimut - sonne));
			const zwilling = rng() < 0.45;
			if (rng() > licht) continue;
			const b = neu(azimut, breite, groesse * k.radius);
			if (!frei(b)) continue;
			eigene.push(b);
			if (!zwilling || eigene.length >= n) continue;
			// Rule 5: a twin of the same size, at the same height, one joint beside it.
			const schritt = (2 * b.radius + FUGE * k.radius) / (k.radius * Math.cos(breite));
			const z = neu(azimut + schritt, breite, b.radius);
			if (frei(z)) eigene.push(z);
		}
		out.push(...eigene);
	});
	return out;
}
