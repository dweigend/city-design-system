import { nextSeed, random } from '../parametrik/random';

export type Seite = 'nord' | 'ost' | 'sued' | 'west';
export type Tor = { zelle: number; seite: Seite };
export type WfcOptionen = {
	breite?: number;
	hoehe?: number;
	saat: number;
	haeuser?: number[];
	tore?: Tor[];
};
export type Schritt = { zelle: number; kachel: number; optionen: number[] };
export type WfcErgebnis = {
	breite: number;
	hoehe: number;
	kacheln: number[];
	start: number[];
	schritte: Schritt[];
	status: 'fertig' | 'widerspruch';
	versuche: number;
};

const SEITEN: readonly Seite[] = ['nord', 'ost', 'sued', 'west'];
const BITS = [1, 2, 4, 8];
const GEGEN = [4, 8, 1, 2];
const KACHELN = [0, 3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
const MAX_VERSUCHE = 30;

function gewicht(k: number): number {
	if (k === 0) return 6;
	if (k === 5 || k === 10) return 3;
	if (k === 15) return 0.5;
	if (k === 7 || k === 11 || k === 13 || k === 14) return 1;
	return 2;
}

function nachbarn(i: number, breite: number, hoehe: number): number[] {
	const x = i % breite,
		y = Math.floor(i / breite);
	return [
		y > 0 ? i - breite : -1,
		x < breite - 1 ? i + 1 : -1,
		y < hoehe - 1 ? i + breite : -1,
		x > 0 ? i - 1 : -1
	];
}

/** New list: west and east gates in the middle row (the lower one for an even height). */
export function standardTore(breite = 10, hoehe = 7): Tor[] {
	const links = Math.floor(hoehe / 2) * breite;
	return [
		{ zelle: links, seite: 'west' },
		{ zelle: links + breite - 1, seite: 'ost' }
	];
}

function validiere(breite: number, hoehe: number, o: WfcOptionen, tore: Tor[]): void {
	if (
		!Number.isSafeInteger(breite) ||
		!Number.isSafeInteger(hoehe) ||
		breite < 1 ||
		hoehe < 1 ||
		!Number.isSafeInteger(breite * hoehe) ||
		!Number.isFinite(o.saat)
	) {
		throw new RangeError('Positive integer grid dimensions and a finite seed required.');
	}
	const innen = (i: number) => Number.isInteger(i) && i >= 0 && i < breite * hoehe;
	if (
		(o.haeuser ?? []).some((i) => !innen(i)) ||
		tore.some(
			(t) =>
				!innen(t.zelle) ||
				!SEITEN.includes(t.seite) ||
				nachbarn(t.zelle, breite, hoehe)[SEITEN.indexOf(t.seite)] !== -1
		)
	) {
		throw new RangeError('Buildings must lie inside the grid and gates on an outer edge.');
	}
}

/** AC-3: every changed domain rechecks all adjacent domains. */
function propagiere(dom: number[][], breite: number, hoehe: number): boolean {
	if (dom.some((d) => d.length === 0)) return false;
	const queue = dom.map((_, i) => i);
	for (let q = 0; q < queue.length; q++) {
		const i = queue[q];
		for (const [s, j] of nachbarn(i, breite, hoehe).entries()) {
			if (j < 0) continue;
			const erlaubt = dom[j].filter((b) =>
				dom[i].some((a) => Boolean(a & BITS[s]) === Boolean(b & GEGEN[s]))
			);
			if (erlaubt.length === dom[j].length) continue;
			dom[j] = erlaubt;
			if (!erlaubt.length) return false;
			queue.push(j);
		}
	}
	return true;
}

function entropie(dom: number[]): number {
	const summe = dom.reduce((s, k) => s + gewicht(k), 0);
	return Math.log(summe) - dom.reduce((s, k) => s + gewicht(k) * Math.log(gewicht(k)), 0) / summe;
}

function waehle(dom: number[], rng: () => number): number {
	let rest = rng() * dom.reduce((s, k) => s + gewicht(k), 0);
	for (const k of dom) {
		rest -= gewicht(k);
		if (rest < 0) return k;
	}
	return dom[dom.length - 1];
}

/**
 * WFC v1, detached data without mutating the inputs. Defaults: 10 × 7, two gates,
 * no buildings. The seed is normalized to uint32 as in Mulberry32. Order:
 * cells ascending, neighbors N/E/S/W, tiles by ID; an exact entropy tie is decided by
 * the smallest cell index. One RNG per attempt; the next seed via nextSeed.
 * At most 30 attempts without backtracking. History only for the successful attempt.
 * Undecided/empty domains yield -1. Invalid dimensions/indices/gates: RangeError.
 */
export function wfc(o: WfcOptionen): WfcErgebnis {
	const breite = o.breite ?? 10,
		hoehe = o.hoehe ?? 7;
	const tore = o.tore ?? standardTore(breite, hoehe);
	validiere(breite, hoehe, o, tore);
	const haeuser = new Set(o.haeuser ?? []);
	let saat = o.saat >>> 0;
	let ergebnis: WfcErgebnis;
	for (let versuch = 1; ; versuch++) {
		const rng = random(saat);
		const dom = Array.from({ length: breite * hoehe }, (_, i) => {
			const aussen = nachbarn(i, breite, hoehe);
			return (haeuser.has(i) ? [16] : KACHELN).filter((k) =>
				aussen.every(
					(j, s) =>
						j >= 0 ||
						Boolean(k & BITS[s]) === tore.some((t) => t.zelle === i && t.seite === SEITEN[s])
				)
			);
		});
		let gueltig = propagiere(dom, breite, hoehe);
		const start = dom.map((d) => d.length);
		const schritte: Schritt[] = [];
		while (gueltig) {
			let zelle = -1,
				minimum = Infinity;
			for (let i = 0; i < dom.length; i++) {
				if (dom[i].length <= 1) continue;
				const h = entropie(dom[i]);
				if (h < minimum) {
					minimum = h;
					zelle = i;
				}
			}
			if (zelle < 0) break;
			const kachel = waehle(dom[zelle], rng);
			dom[zelle] = [kachel];
			gueltig = propagiere(dom, breite, hoehe);
			schritte.push({ zelle, kachel, optionen: dom.map((d) => d.length) });
		}
		ergebnis = {
			breite,
			hoehe,
			kacheln: dom.map((d) => (d.length === 1 ? d[0] : -1)),
			start,
			schritte: gueltig ? schritte : [],
			status: gueltig ? 'fertig' : 'widerspruch',
			versuche: versuch
		};
		if (gueltig || versuch === MAX_VERSUCHE) return ergebnis;
		saat = nextSeed(saat);
	}
}

/** New set of all footbridge cells reachable from valid open outer gates.
 * Traverses only edges open on both sides; buildings and -1 are left out.
 * Expects grid data from wfc (or the same result contract); mutates nothing.
 */
export function erreichbar(e: WfcErgebnis, tore: Tor[]): Set<number> {
	const besucht = new Set<number>();
	const steg = (i: number) => e.kacheln[i] > 0 && e.kacheln[i] < 16;
	for (const t of tore) {
		const s = SEITEN.indexOf(t.seite);
		if (
			s >= 0 &&
			t.zelle >= 0 &&
			t.zelle < e.kacheln.length &&
			steg(t.zelle) &&
			nachbarn(t.zelle, e.breite, e.hoehe)[s] === -1 &&
			e.kacheln[t.zelle] & BITS[s]
		)
			besucht.add(t.zelle);
	}
	const queue = [...besucht];
	for (let q = 0; q < queue.length; q++) {
		const i = queue[q];
		for (const [s, j] of nachbarn(i, e.breite, e.hoehe).entries()) {
			if (j < 0 || besucht.has(j) || !steg(j)) continue;
			if (e.kacheln[i] & BITS[s] && e.kacheln[j] & GEGEN[s]) {
				besucht.add(j);
				queue.push(j);
			}
		}
	}
	return besucht;
}
