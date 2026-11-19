/**
 * One house as a job: serializable input, serializable result, deterministic cache key. The same
 * pure function serves both modes of operation:
 * - development: the `precompute:statik` command runs it ahead of time and stores the results in
 *   `data/vorberechnet/haengehaus.json`;
 * - runtime: a web worker runs it behind the queue of `logic/statik/warteschlange.ts`.
 * Headless; no worker, clock or cache lives here.
 */
import gespeichert from '../../data/vorberechnet/haengehaus.json';
import {
	HAENGEHAUS_VERSION,
	belegungVon,
	einsetzen,
	entfernen,
	hausParameter,
	kandidaten,
	nachrechnen,
	nutzungSetzen,
	type Bauplan,
	type Belegung,
	type HausFamilie,
	type Stufe
} from '../haus-tragwerk';
import { schluessel } from '../statik';
import { bewohntesHaus } from './ensemble';

/**
 * `belegung`: occupancy the carrier is checked for; omitted means the inhabited house as built
 * (people in the room, garden on its roof).
 */
export type HausAuftrag = { familie: HausFamilie; saat: number; stufe: Stufe; belegung?: Belegung };
export type HausErgebnis = {
	haus: Bauplan;
	/** Problem size for measurements: carrier nodes and sized members incl. capsule links. */
	knoten: number;
	staebe: number;
};
const BEWOHNT: Belegung = { raum: 'people', garten: true };

/**
 * Key of a job: generator version and everything the result depends on. For the simulated house
 * that is what the seed decides (`hausParameter`), not the seed itself: two seeds that draw the
 * same house share one key and one computation. A rule change invalidates every key.
 */
export function hausSchluessel(a: HausAuftrag): string {
	return schluessel({
		version: HAENGEHAUS_VERSION,
		familie: a.familie,
		...(a.familie === 'raumfachwerk'
			? { parameter: hausParameter(a.saat >>> 0) }
			: { saat: a.saat >>> 0 }),
		stufe: a.stufe,
		belegung: a.belegung ?? BEWOHNT
	});
}

/**
 * Computes the house: form for the seed, then the check of the built carrier under the asked
 * occupancy. Pure and synchronous; call it from a worker or a build script. Throws `RangeError`
 * if the carrier does not stand.
 */
export function rechneHaus(a: HausAuftrag): HausErgebnis {
	let haus = bewohntesHaus(a.familie, a.saat, a.stufe);
	if (a.belegung) haus = mitBelegung(haus, a.belegung);
	return {
		haus,
		knoten: haus.traeger.knoten.length,
		staebe: haus.traeger.kanten.length + (haus.statik?.haenger.length ?? 0)
	};
}

/**
 * Brings the house to an occupancy through its public actions and checks the carrier again.
 * Returns the house unchanged if it already has that occupancy and a matching check.
 */
export function mitBelegung(haus: Bauplan, belegung: Belegung): Bauplan {
	const von = (art: 'raum' | 'garten') => kandidaten(haus).find((k) => k.art === art);
	const einbau = (h: Bauplan, anschlussId?: string) =>
		h.einbauten.find((e) => e.anschlussId === anschlussId);
	const raum = von('raum'),
		garten = von('garten');
	let next = haus;
	const jetzt = belegungVon(next);
	if (raum && belegung.raum === 'leer') {
		const e = einbau(next, raum.id);
		if (e) next = entfernen(next, e.id).plan;
	} else if (raum && belegung.raum !== 'leer') {
		const e = einbau(next, raum.id);
		if (!e) next = einsetzen(next, raum.id, belegung.raum).plan;
		else if (jetzt.raum !== belegung.raum) next = nutzungSetzen(next, e.id, belegung.raum).plan;
		const g = einbau(next, garten?.id);
		if (garten && belegung.garten && !g) next = einsetzen(next, garten.id, 'food').plan;
		if (g && !belegung.garten) next = entfernen(next, g.id).plan;
	}
	const stand = next.statik?.belegung;
	const ist = belegungVon(next);
	if (stand && stand !== 'bemessung' && stand.raum === ist.raum && stand.garten === ist.garten)
		return next;
	return nachrechnen(next);
}

/** Result computed ahead of time for exactly this job, or `undefined`. Detached per call. */
export function vorberechnet(a: HausAuftrag): HausErgebnis | undefined {
	const eintrag = (gespeichert as Record<string, unknown>)[hausSchluessel(a)];
	if (eintrag === undefined) return undefined;
	const ergebnis = structuredClone(eintrag) as HausErgebnis;
	// The stored house was computed for one seed of its parameter class; the plan names the asked one.
	ergebnis.haus.saat = ergebnis.haus.traeger.saat = a.saat >>> 0;
	return ergebnis;
}

/** Jobs that the development mode computes ahead: what a first visit shows, in all three steps. */
export const VORBERECHNETE_AUFTRAEGE: HausAuftrag[] = (['abtrag', 'kraefte', 'block'] as const).map(
	(stufe) => ({ familie: 'raumfachwerk', saat: 42, stufe })
);
