/**
 * Teaching version "Growth": three families from 102/gewachsen-exp, scaled down heavily (400 × 400 m).
 * zugang ≈ g1/g5 (paths first, blocks as remainder), feld ≈ g2 (direction field), ring ≈ g4 (shells).
 * Every edge carries a birth time; the state at t is the filtered final history.
 */
import { random } from '../parametrik/random';
import { Netz, flaechen, type Punkt } from './netz';

import type { Familie } from '../../data/wachstum';
export type { Familie } from '../../data/wachstum';
export type WachstumOptionen = {
	familie: Familie;
	saat: number;
	/** zugang only: binding to a smooth direction field (0 = g1, 0.45 = g5). */
	bindung?: number;
};
export type Wachstum = { netz: Netz; groesse: number; familie: Familie; saat: number };
export type Kennzahlen = {
	wege: number;
	bloecke: number;
	a50: number;
	cv: number;
	h: number;
	t: number;
	x: number;
	sackenden: number;
};

export const GROESSE = 400;
/** Reference ranges old town/medina (Siena, Regensburg, Fès, Marrakesch), 102. */
export const referenz = {
	a50: [492.78, 903.38],
	cv: [1.52, 3.36],
	h: [0.79, 0.99],
	t: [73.5, 84.93]
} as const;

const RAND = 3;
/** Tuned to seeds 1/19/45 of this teaching version (not to the Python experiments). */
const VERSUCHE = 1300,
	KREUZEN = 0.45,
	ABSTAND = [12, 8],
	SIGMA = 0.2;

function rahmen(netz: Netz, g: number) {
	const ecken: Punkt[] = [
		[0, 0],
		[g, 0],
		[g, g],
		[0, g]
	];
	const ids = ecken.map(([x, y]) => netz.knoten(x, y, true));
	ids.forEach((id, i) => netz.verbinde(id, ids[(i + 1) % 4], 0, RAND));
}

/** Smallest angular distance to one of the symmetric field directions θ + k·sym. */
function richte(winkel: number, feld: number, sym: number) {
	const k = Math.round((winkel - feld) / sym);
	return feld + k * sym;
}
const mischeWinkel = (a: number, b: number, f: number) => {
	const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
	return a + d * f;
};

type Weg = {
	schritt: number;
	laenge: number;
	drehung: number;
	klasse: number;
	tag?: number;
	kreuzen: number;
	fang: number;
	feld?: (x: number, y: number) => number;
	sym?: number;
	bindung?: number;
	/** Stop when another line of the same family comes closer than r. */
	nah?: { r: number; nur: (e: number) => boolean };
	/** Nodes of the path (for seed points). */
	knoten?: number[];
};

/** Grows from a node in steps until it hits a path, reaches the length or is stopped. */
function wachse(
	netz: Netz,
	start: number,
	winkel: number,
	w: Weg,
	rng: () => number,
	takt: { n: number }
) {
	let cur = start,
		gegangen = 0,
		wink = winkel;
	while (gegangen < w.laenge) {
		wink += (rng() - 0.5) * 2 * w.drehung;
		if (w.feld)
			wink = mischeWinkel(
				wink,
				richte(wink, w.feld(netz.x[cur], netz.y[cur]), w.sym ?? Math.PI / 2),
				w.bindung ?? 1
			);
		const p: Punkt = [netz.x[cur], netz.y[cur]];
		const dx = Math.cos(wink),
			dy = Math.sin(wink);
		const weit: Punkt = [p[0] + dx * (w.schritt + w.fang), p[1] + dy * (w.schritt + w.fang)];
		const hits = netz.treffer(p, weit, (e) => netz.a[e] === cur || netz.b[e] === cur);
		if (hits.length) {
			const h = hits[0];
			const randKante = netz.klasse[h.kante] === RAND;
			const n = netz.teile(h.kante, h.u);
			netz.verbinde(cur, n, takt.n++, w.klasse, w.tag);
			w.knoten?.push(n);
			if (randKante || rng() >= w.kreuzen) return;
			cur = n;
			gegangen += h.s * (w.schritt + w.fang);
			continue;
		}
		const q: Punkt = [p[0] + dx * w.schritt, p[1] + dy * w.schritt];
		if (
			w.nah &&
			netz.abstand(q, w.nah.r, (e) => w.nah!.nur(e) && netz.a[e] !== cur && netz.b[e] !== cur) <
				w.nah.r
		)
			return;
		const nah = netz.naechster(q, w.fang, (n) => n === cur || netz.verbunden(n, cur));
		if (nah >= 0) {
			const ziel: Punkt = [netz.x[nah], netz.y[nah]];
			const quer = netz.treffer(
				p,
				ziel,
				(e) => netz.a[e] === cur || netz.b[e] === cur || netz.a[e] === nah || netz.b[e] === nah
			);
			if (!quer.length) {
				netz.verbinde(cur, nah, takt.n++, w.klasse, w.tag);
				w.knoten?.push(nah);
				return;
			}
		}
		const n = netz.knoten(q[0], q[1]);
		netz.verbinde(cur, n, takt.n++, w.klasse, w.tag);
		w.knoten?.push(n);
		cur = n;
		gegangen += w.schritt;
	}
}

const grad = (netz: Netz, n: number) => netz.inzident[n].filter((e) => !netz.tot[e]).length;

function dichteFeld(kerne: { p: Punkt; s: number; g: number }[]) {
	return (x: number, y: number) =>
		Math.max(
			0.06,
			...kerne.map(
				(k) => k.g * Math.exp(-((x - k.p[0]) ** 2 + (y - k.p[1]) ** 2) / (2 * k.s * k.s))
			)
		);
}

function zugang(netz: Netz, g: number, rng: () => number, bindung: number) {
	const takt = { n: 1 };
	const phase = rng() * 6.283,
		phase2 = rng() * 6.283;
	const feld = (x: number, y: number) =>
		0.2 + phase * 0.05 + 0.65 * Math.sin(x / 124 + phase) + 0.45 * Math.sin(y / 104 + phase2);
	const kerne = [
		{ p: [g * (0.38 + rng() * 0.12), g * (0.4 + rng() * 0.15)] as Punkt, s: g * SIGMA, g: 1 },
		{ p: [g * (0.62 + rng() * 0.12), g * (0.55 + rng() * 0.15)] as Punkt, s: g * 0.16, g: 0.7 }
	];
	const dichte = dichteFeld(kerne);
	const binde = bindung > 0 ? { feld, sym: Math.PI / 2, bindung } : {};
	// Main paths: gates at the boundary → core.
	for (let i = 0; i < 4; i++) {
		const seite = i,
			f = 0.25 + rng() * 0.5;
		const p: Punkt =
			seite === 0 ? [f * g, 0] : seite === 1 ? [g, f * g] : seite === 2 ? [f * g, g] : [0, f * g];
		const kanten = netz.treffer(
			[
				p[0] - (seite === 1 ? -1 : seite === 3 ? 1 : 0),
				p[1] - (seite === 2 ? -1 : seite === 0 ? 1 : 0)
			],
			[
				p[0] + (seite === 1 ? -1 : seite === 3 ? 1 : 0),
				p[1] + (seite === 2 ? -1 : seite === 0 ? 1 : 0)
			]
		);
		const start = kanten.length
			? netz.teile(kanten[0].kante, kanten[0].u)
			: netz.knoten(p[0], p[1], true);
		const ziel = kerne[i % 2].p;
		wachse(
			netz,
			start,
			Math.atan2(ziel[1] - p[1], ziel[0] - p[0]),
			{ schritt: 10, laenge: g * 1.2, drehung: 0.12, klasse: 0, kreuzen: 0.5, fang: 6, ...binde },
			rng,
			takt
		);
	}
	// Branches along the frontages, weighted by density.
	for (let versuch = 0; versuch < VERSUCHE; versuch++) {
		const kanten = netz.lebend().filter((e) => netz.klasse[e] !== RAND);
		let summe = 0;
		const gewicht = kanten.map((e) => {
			const mx = (netz.x[netz.a[e]] + netz.x[netz.b[e]]) / 2,
				my = (netz.y[netz.a[e]] + netz.y[netz.b[e]]) / 2;
			return (summe += netz.laenge(e) * dichte(mx, my) ** 1.5);
		});
		const r = rng() * summe;
		const e =
			kanten[
				Math.max(
					0,
					gewicht.findIndex((w) => w >= r)
				)
			];
		const l = netz.laenge(e);
		const ax = netz.x[netz.a[e]],
			ay = netz.y[netz.a[e]];
		const u = rng();
		const abstand = ABSTAND[0] + ABSTAND[1] * (1 - dichte(ax, ay));
		if (u * l < 1 || (1 - u) * l < 1) continue;
		const p: Punkt = [ax + (netz.x[netz.b[e]] - ax) * u, ay + (netz.y[netz.b[e]] - ay) * u];
		if (netz.naechster(p, abstand, (n) => grad(netz, n) === 2 && !netz.rand[n]) >= 0) continue;
		const winkel =
			Math.atan2(netz.y[netz.b[e]] - ay, netz.x[netz.b[e]] - ax) +
			(rng() < 0.5 ? 1 : -1) * (Math.PI / 2 + (rng() - 0.5) * 0.5);
		const probe: Punkt = [p[0] + Math.cos(winkel) * abstand, p[1] + Math.sin(winkel) * abstand];
		if (netz.treffer(p, probe, (k) => k === e).length) continue;
		const d = dichte(p[0], p[1]);
		const start = netz.teile(e, u);
		wachse(
			netz,
			start,
			winkel,
			{
				schritt: 8,
				laenge: 30 + rng() * (60 + 160 * (1 - d)),
				drehung: 0.1,
				klasse: netz.klasse[e] === 0 ? 1 : 2,
				kreuzen: KREUZEN,
				fang: 4,
				...binde
			},
			rng,
			takt
		);
	}
	return takt.n;
}

function feldNetz(netz: Netz, g: number, rng: () => number) {
	const takt = { n: 1 };
	const p1 = rng() * 6.283,
		p2 = rng() * 6.283,
		c: Punkt = [g * (0.4 + rng() * 0.2), g * (0.4 + rng() * 0.2)];
	const feld = (x: number, y: number) =>
		0.3 +
		0.55 * Math.sin(x / 150 + p1) +
		0.4 * Math.sin(y / 120 + p2) +
		0.3 * Math.sin((x + y) / 90 + p1 * 2);
	const dichte = dichteFeld([{ p: c, s: g * 0.3, g: 1 }]);
	const familie: number[] = [];
	const warteschlange: { n: number; f: number }[] = [];
	const linie = (start: number, f: number, richtungen: number[]) => {
		const tag = familie.length;
		familie.push(f);
		const knoten: number[] = [];
		const dsep = 14 + 26 * (1 - dichte(netz.x[start], netz.y[start]));
		for (const s of richtungen) {
			const w0 = feld(netz.x[start], netz.y[start]) + (f * Math.PI) / 2 + (s < 0 ? Math.PI : 0);
			wachse(
				netz,
				start,
				w0,
				{
					schritt: 7,
					laenge: g * 1.5,
					drehung: 0,
					klasse: tag === 0 ? 0 : tag < 6 ? 1 : 2,
					tag,
					kreuzen: 0.35,
					fang: 3,
					feld: (x, y) => feld(x, y) + (f * Math.PI) / 2,
					sym: Math.PI,
					bindung: 1,
					nah: {
						r: dsep * 0.45,
						nur: (e) => netz.tag[e] >= 0 && familie[netz.tag[e]] === f && netz.tag[e] !== tag
					},
					knoten
				},
				rng,
				takt
			);
		}
		const takt2 = Math.max(2, Math.round(dsep / 7));
		knoten.forEach((n, i) => {
			if (i % takt2 === takt2 - 1 && !netz.rand[n]) warteschlange.push({ n, f: 1 - f });
		});
	};
	linie(netz.knoten(c[0], c[1]), 0, [1, -1]);
	let schutz = 0;
	while (warteschlange.length && schutz++ < 900) {
		const { n, f } = warteschlange.shift()!;
		const dsep = 14 + 26 * (1 - dichte(netz.x[n], netz.y[n]));
		const nahe = netz.abstand([netz.x[n], netz.y[n]], dsep, (e) => {
			const t = netz.tag[e];
			return t >= 0 && familie[t] === f && netz.a[e] !== n && netz.b[e] !== n;
		});
		if (nahe < dsep * 0.8) continue;
		linie(n, f, rng() < 0.55 ? [1, -1] : [rng() < 0.5 ? 1 : -1]);
	}
	return takt.n;
}

function ringNetz(netz: Netz, g: number, rng: () => number) {
	const takt = { n: 1 };
	const c: Punkt = [g * (0.45 + rng() * 0.1), g * (0.45 + rng() * 0.1)];
	const phase = rng() * 6.283;
	const schalen = 9,
		r0 = 16,
		dr = 23;
	const radius = (k: number, w: number) =>
		(r0 + k * dr) * (1 + 0.07 * Math.sin(3 * w + phase) + 0.04 * Math.sin(5 * w - phase * 2));
	const imRahmen = (p: Punkt) => p[0] > 0 && p[0] < g && p[1] > 0 && p[1] < g;
	let vorige: number[] = [];
	for (let k = 0; k < schalen; k++) {
		const segmente = 24 + k * 8;
		const pts: Punkt[] = Array.from({ length: segmente }, (_, i) => {
			const w = (i / segmente) * Math.PI * 2;
			const r = radius(k, w);
			return [c[0] + Math.cos(w) * r, c[1] + Math.sin(w) * r];
		});
		const ids = pts.map((p) => (imRahmen(p) ? netz.knoten(p[0], p[1]) : -1));
		const geburt = takt.n++;
		for (let i = 0; i < segmente; i++) {
			const j = (i + 1) % segmente;
			if (ids[i] >= 0 && ids[j] >= 0) netz.verbinde(ids[i], ids[j], geburt, k === 0 ? 0 : 2, k);
			else if (ids[i] >= 0 || ids[j] >= 0) {
				// Ring leaves the frame: split at the boundary.
				const innen = ids[i] >= 0 ? i : j;
				const aussen = innen === i ? j : i;
				const hits = netz.treffer(pts[innen], pts[aussen], (e) => netz.klasse[e] !== RAND);
				if (hits.length)
					netz.verbinde(ids[innen], netz.teile(hits[0].kante, hits[0].u), geburt, 2, k);
			}
		}
		if (k === 0) {
			// Core densification: two chords.
			for (const w of [phase, phase + Math.PI / 2]) {
				const a: Punkt = [c[0] + Math.cos(w) * r0 * 1.5, c[1] + Math.sin(w) * r0 * 1.5];
				const b: Punkt = [c[0] - Math.cos(w) * r0 * 1.5, c[1] - Math.sin(w) * r0 * 1.5];
				einfuegen(netz, a, b, takt.n++, 1, k);
			}
			continue;
		}
		// Connectors from shell k−1 to k; some continue an older connector (X).
		const umfang = 2 * Math.PI * (r0 + k * dr);
		const zahl = Math.max(4, Math.round(umfang / (24 + rng() * 10)));
		const enden: number[] = [];
		for (let i = 0; i < zahl; i++) {
			let start: number,
				w = ((i + rng() * 0.6) / zahl) * Math.PI * 2;
			if (vorige.length && rng() < 0.3) {
				start = vorige[Math.floor(rng() * vorige.length)];
				w = Math.atan2(netz.y[start] - c[1], netz.x[start] - c[0]);
			} else {
				const fern: Punkt = [c[0] + Math.cos(w) * g * 2, c[1] + Math.sin(w) * g * 2];
				const hits = netz.treffer(c, fern).filter((h) => netz.tag[h.kante] === k - 1);
				if (!hits.length) continue;
				start = netz.teile(hits[0].kante, hits[0].u);
			}
			const knoten: number[] = [];
			wachse(
				netz,
				start,
				w,
				{
					schritt: dr * 0.5,
					laenge: dr * 1.8,
					drehung: 0.02,
					klasse: k < 3 ? 1 : 2,
					kreuzen: 0,
					fang: 0,
					knoten
				},
				rng,
				takt
			);
			const ende = knoten.at(-1);
			if (ende !== undefined && !netz.rand[ende]) enden.push(ende);
		}
		vorige = enden;
	}
	return takt.n;
}

/** Inserts a segment with full noding (all intersections are split). */
function einfuegen(netz: Netz, p: Punkt, q: Punkt, geburt: number, klasse: number, tag: number) {
	const hits = netz.treffer(p, q);
	let cur = netz.knoten(p[0], p[1]);
	for (const h of hits) {
		const n = netz.teile(h.kante, h.u);
		netz.verbinde(cur, n, geburt, klasse, tag);
		cur = n;
	}
	netz.verbinde(cur, netz.knoten(q[0], q[1]), geburt, klasse, tag);
}

/** Generates the complete growth history (deterministic per seed). */
export function wachstum(o: WachstumOptionen): Wachstum {
	const netz = new Netz(24);
	const g = GROESSE;
	const rng = random(o.saat);
	rahmen(netz, g);
	const takte =
		o.familie === 'zugang'
			? zugang(netz, g, rng, o.bindung ?? 0.45)
			: o.familie === 'feld'
				? feldNetz(netz, g, rng)
				: ringNetz(netz, g, rng);
	// Normalize birth: 0 = frame, (0, 1] = growth.
	for (let e = 0; e < netz.geburt.length; e++)
		netz.geburt[e] = netz.klasse[e] === RAND ? 0 : netz.geburt[e] / Math.max(1, takte - 1);
	return { netz, groesse: g, familie: o.familie, saat: o.saat };
}

const lebendBis = (w: Wachstum, t: number) =>
	w.netz.lebend().filter((e) => w.netz.klasse[e] === RAND || w.netz.geburt[e] <= t + 1e-12);

const median = (v: number[]) => {
	if (!v.length) return 0;
	const s = [...v].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Metrics as in 102 (simplified): blocks without boundary contact > 25 m², T/X without boundary nodes, H in 18 classes. */
export function kennzahlen(w: Wachstum, t: number): Kennzahlen {
	const netz = w.netz;
	const kanten = lebendBis(w, t);
	const wege = kanten.filter((e) => netz.klasse[e] !== RAND);
	const grad = new Map<number, number>();
	for (const e of kanten)
		for (const n of [netz.a[e], netz.b[e]]) grad.set(n, (grad.get(n) ?? 0) + 1);
	let t3 = 0,
		x4 = 0,
		sack = 0;
	for (const [n, d] of grad) {
		if (netz.rand[n]) continue;
		if (d === 1) sack++;
		else if (d === 3) t3++;
		else if (d >= 4) x4++;
	}
	const klassen = new Array(18).fill(0);
	let summe = 0;
	for (const e of wege) {
		const l = netz.laenge(e);
		let w0 = Math.atan2(
			netz.y[netz.b[e]] - netz.y[netz.a[e]],
			netz.x[netz.b[e]] - netz.x[netz.a[e]]
		);
		w0 = ((w0 % Math.PI) + Math.PI) % Math.PI;
		klassen[Math.min(17, Math.floor((w0 / Math.PI) * 18))] += l;
		summe += l;
	}
	const h = summe
		? -klassen.reduce((s, k) => (k > 0 ? s + (k / summe) * Math.log(k / summe) : s), 0) /
			Math.log(18)
		: 0;
	const bloecke = flaechen(netz, kanten)
		.filter((f) => f.flaeche > 25 && !f.knoten.some((n) => netz.rand[n]))
		.map((f) => f.flaeche);
	const mittel = bloecke.reduce((s, a) => s + a, 0) / Math.max(1, bloecke.length);
	const sd = Math.sqrt(
		bloecke.reduce((s, a) => s + (a - mittel) ** 2, 0) / Math.max(1, bloecke.length)
	);
	const knoten = t3 + x4;
	return {
		wege: wege.length,
		bloecke: bloecke.length,
		a50: median(bloecke),
		cv: mittel ? sd / mittel : 0,
		h,
		t: knoten ? (100 * t3) / knoten : 0,
		x: knoten ? (100 * x4) / knoten : 0,
		sackenden: sack
	};
}

/** SVG paths at t: paths by class, blocks as fill, the newest paths separately. */
export function wachstumsBild(w: Wachstum, t: number, frisch = 0.06) {
	const netz = w.netz;
	const kanten = lebendBis(w, t);
	const f = (v: number) => v.toFixed(1);
	const seg = (e: number) =>
		`M${f(netz.x[netz.a[e]])} ${f(netz.y[netz.a[e]])}L${f(netz.x[netz.b[e]])} ${f(netz.y[netz.b[e]])}`;
	const haupt: string[] = [],
		neben: string[] = [],
		neu: string[] = [];
	for (const e of kanten) {
		if (netz.klasse[e] === RAND) continue;
		if (netz.geburt[e] > t - frisch && t < 1) neu.push(seg(e));
		else if (netz.klasse[e] === 0) haupt.push(seg(e));
		else neben.push(seg(e));
	}
	const bloecke = flaechen(netz, kanten)
		.filter((b) => b.flaeche > 25 && !b.knoten.some((n) => netz.rand[n]))
		.map((b) => 'M' + b.knoten.map((n) => `${f(netz.x[n])} ${f(netz.y[n])}`).join('L') + 'Z');
	return {
		haupt: haupt.join(''),
		neben: neben.join(''),
		neu: neu.join(''),
		bloecke: bloecke.join('')
	};
}

/** Checksum of the history (FNV-1a over rounded geometry, classes and births). */
export function pruefsumme(w: Wachstum) {
	let h = 0x811c9dc5;
	const mix = (s: string) => {
		for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	};
	for (const e of w.netz.lebend())
		mix(
			`${w.netz.x[w.netz.a[e]].toFixed(4)},${w.netz.y[w.netz.a[e]].toFixed(4)},${w.netz.x[w.netz.b[e]].toFixed(4)},${w.netz.y[w.netz.b[e]].toFixed(4)},${w.netz.klasse[e]},${w.netz.geburt[e].toFixed(6)};`
		);
	return (h >>> 0).toString(16).padStart(8, '0');
}
