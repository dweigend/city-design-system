/**
 * Glowing packets along the paths of the color lab. Headless: position from path, phase and distance.
 * Units: meters. Phase and direction follow from the index, not from chance (deterministic).
 * The cycle is not a flow of its own but a property of every flow: on every path every second
 * packet runs back (return flow).
 */
import type { Modell, Vec3, Weg } from './quartier';

/** Direction 1 runs from the first to the last point, -1 back. */
export type Richtung = 1 | -1;
export type Paket = { weg: Weg; laenge: number; phase: number; richtung: Richtung };

/** Packets per meter of path. */
const DICHTE = 0.1;

const abstand = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function laenge(w: Weg): number {
	return w.punkte.slice(1).reduce((sum, p, i) => sum + abstand(p, w.punkte[i]), 0);
}

/** At least two packets per path, evenly spaced; even indices outbound, odd ones back. */
export function pakete(m: Modell): Paket[] {
	return m.wege.flatMap((weg) => {
		const l = laenge(weg);
		const n = Math.max(2, Math.round(l * DICHTE));
		return Array.from({ length: n }, (_, k) => ({
			weg,
			laenge: l,
			phase: k / n,
			richtung: (k % 2 ? -1 : 1) as Richtung
		}));
	});
}

/** Position of a packet after `strecke` meters in its direction; wraps around at the end. */
export function paketLage(p: Paket, strecke: number): Vec3 {
	let rest = ((((p.phase + (p.richtung * strecke) / p.laenge) % 1) + 1) % 1) * p.laenge;
	const pts = p.weg.punkte;
	for (let i = 1; i < pts.length; i++) {
		const seg = abstand(pts[i], pts[i - 1]);
		if (rest <= seg) {
			const t = seg ? rest / seg : 0;
			return pts[i - 1].map((v, k) => v + (pts[i][k] - v) * t) as Vec3;
		}
		rest -= seg;
	}
	return pts[pts.length - 1];
}
