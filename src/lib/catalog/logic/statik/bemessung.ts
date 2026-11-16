/**
 * Member sizing: the smallest catalog section that carries a tension and a compression force.
 * Tension takes a solid rod; any compression needs a tube and is checked against Euler buckling.
 * Demo checks with declared safety, not a code verification (docs/research/122, appendix C).
 */
import type { Werkstoff } from './modell';

export type Querschnitt = {
	art: 'rundstab' | 'rohr';
	durchmesserM: number;
	flaecheM2: number;
	/** Second moment of area; decides buckling. */
	traegheitM4: number;
};
/** Tube wall = diameter / 20, a common slender structural hollow section. */
const ROHR_WANDANTEIL = 1 / 20;
/** Safety against ideal Euler buckling of a pin-ended member; covers imperfection roughly. */
export const KNICKSICHERHEIT = 2.5;
/** Outer diameters in meters, ascending. Tubes follow common hollow-section sizes. */
export type Katalog = { rundstaebeM: number[]; rohreM: number[] };
const mm = (d: number) => d / 1e3;
export const KATALOG_FEIN: Katalog = {
	rundstaebeM: [12, 16, 20, 24, 30, 36, 42, 48, 56, 64, 72, 80, 90, 100].map(mm),
	rohreM: [
		60.3, 76.1, 88.9, 101.6, 114.3, 139.7, 168.3, 193.7, 219.1, 244.5, 273, 323.9, 355.6, 406.4,
		457, 508
	].map(mm)
};
/**
 * Few steps, each about 1.5 times the one before: members fall into a handful of visible
 * weights, as parts of one kit would. Costs steel against `KATALOG_FEIN`; the house measures it.
 */
export const KATALOG_RUHIG: Katalog = {
	rundstaebeM: [16, 24, 36, 56, 80, 100].map(mm),
	rohreM: [76.1, 114.3, 168.3, 244.5, 355.6, 508].map(mm)
};

export function rundstab(durchmesserM: number): Querschnitt {
	return {
		art: 'rundstab',
		durchmesserM,
		flaecheM2: (Math.PI * durchmesserM ** 2) / 4,
		traegheitM4: (Math.PI * durchmesserM ** 4) / 64
	};
}
export function rohr(durchmesserM: number): Querschnitt {
	const innen = durchmesserM * (1 - 2 * ROHR_WANDANTEIL);
	return {
		art: 'rohr',
		durchmesserM,
		flaecheM2: (Math.PI * (durchmesserM ** 2 - innen ** 2)) / 4,
		traegheitM4: (Math.PI * (durchmesserM ** 4 - innen ** 4)) / 64
	};
}
/** Shape constant of the tube family: I = ROHR_FORM · A². */
const ROHR_FORM = rohr(1).traegheitM4 / rohr(1).flaecheM2 ** 2;
export const KLEINSTER_QUERSCHNITT = rundstab(KATALOG_FEIN.rundstaebeM[0]);

/**
 * Share of the capacity in use, ≥ 0. Tension: N / (A·f). Compression: the larger of squashing and
 * Euler buckling with `KNICKSICHERHEIT`; a rod has no compression capacity (∞ if compressed).
 */
export function ausnutzung(
	q: Querschnitt,
	laengeM: number,
	zugN: number,
	druckN: number,
	w: Werkstoff
): number {
	const zug = zugN / (q.flaecheM2 * w.grenzspannungPa);
	if (druckN <= 0) return zug;
	if (q.art === 'rundstab') return Infinity;
	const knicklastN = (Math.PI ** 2 * w.eModulPa * q.traegheitM4) / laengeM ** 2 / KNICKSICHERHEIT;
	return Math.max(zug, druckN / (q.flaecheM2 * w.grenzspannungPa), druckN / knicklastN);
}

/**
 * Continuous area a member needs, m². Drives the removal iteration before catalog sizes apply.
 */
export function bedarfM2(laengeM: number, zugN: number, druckN: number, w: Werkstoff): number {
	const fliessen = Math.max(zugN, druckN) / w.grenzspannungPa;
	if (druckN <= 0) return fliessen;
	const knicken =
		laengeM * Math.sqrt((druckN * KNICKSICHERHEIT) / (Math.PI ** 2 * w.eModulPa * ROHR_FORM));
	return Math.max(fliessen, knicken);
}

/**
 * Smallest section of `katalog` with utilization ≤ 1 and at least `mindestM2` of area, or
 * `undefined` if the catalog ends. `druckN > 0` selects a tube.
 */
export function bemesse(
	laengeM: number,
	zugN: number,
	druckN: number,
	w: Werkstoff,
	mindestM2 = 0,
	katalog: Katalog = KATALOG_FEIN
): Querschnitt | undefined {
	const auswahl = druckN > 0 ? katalog.rohreM.map(rohr) : katalog.rundstaebeM.map(rundstab);
	return auswahl.find(
		(q) => q.flaecheM2 >= mindestM2 && ausnutzung(q, laengeM, zugN, druckN, w) <= 1
	);
}
