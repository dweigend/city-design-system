/**
 * Deformation leeway: a cage of eight points deforms the tower
 * (logic/modellierung/cage.ts). Every position is allowed in which the stair keeps its clear
 * width and no module flips. At the boundary the slider stops. Meters, radians.
 */
import {
	TREPPE,
	kontrollpunkte,
	minJacobian,
	treppenbreite,
	type CageOptionen
} from '../modellierung/cage';

export type Achse = 'scherung' | 'verjuengung' | 'drehung';

/** Smallest normalized Jacobian below which a module counts as flipped. */
export const JACOBI_MIN = 0.05;

/** Sliders: tilt as offset per meter of height, taper as a share, twist in radians. */
export const ACHSEN: Record<Achse, { min: number; max: number; step: number }> = {
	scherung: { min: 0, max: 0.3, step: 0.01 },
	verjuengung: { min: 0, max: 0.3, step: 0.005 },
	drehung: { min: 0, max: 0.8, step: 0.01 }
};

export const startVerformung: CageOptionen = {
	saat: 3,
	scherung: 0.12,
	verjuengung: 0.02,
	drehung: 0.1
};

/** Does the position comply: stair clear width at least as required, no module flipped. */
export function zulaessig(o: CageOptionen): boolean {
	const p = kontrollpunkte(o);
	return treppenbreite(p) >= TREPPE.soll - 1e-9 && minJacobian(p) > JACOBI_MIN;
}

/**
 * New value of an axis, at most up to the edge of the leeway. If the target is invalid,
 * bisection finds the last valid value between now and the target (to within 1e-4).
 */
export function begrenze(o: CageOptionen, achse: Achse, ziel: number): number {
	if (zulaessig({ ...o, [achse]: ziel })) return ziel;
	let gut = o[achse],
		schlecht = ziel;
	if (!zulaessig(o)) return gut;
	for (let i = 0; i < 30 && Math.abs(schlecht - gut) > 1e-4; i++) {
		const mitte = (gut + schlecht) / 2;
		if (zulaessig({ ...o, [achse]: mitte })) gut = mitte;
		else schlecht = mitte;
	}
	return gut;
}

/** Is the position at the boundary? (A small step further on one axis would be invalid.) */
export function amRand(o: CageOptionen): boolean {
	return (['verjuengung', 'drehung', 'scherung'] as Achse[]).some((a) => {
		const weiter = o[a] + ACHSEN[a].step;
		return weiter <= ACHSEN[a].max && !zulaessig({ ...o, [a]: weiter });
	});
}
