/**
 * Linear elastic pin-jointed space truss by the direct stiffness method: K·u = f. Members carry
 * axial force only; three translations per node. Headless and deterministic.
 */
import { addiere, huellmatrix, zerlege } from './numerik';
import type { Fehlschlag, Knoten, Lager, Lastfall, Vec3 } from './modell';

export type Stab = {
	id: string;
	a: string;
	b: string;
	flaecheM2: number;
	eModulPa: number;
	/** Cable or rod: compression is reported in `Loesung.schlaff`, the solve stays linear. */
	nurZug?: boolean;
};
export type Fachwerk = { knoten: Knoten[]; staebe: Stab[]; lager: Lager[] };
export type Loesung = {
	lastfallId: string;
	verschiebungenM: Record<string, Vec3>;
	/** Axial force per member, tension positive. */
	stabkraefteN: Record<string, number>;
	/** Bearing force on the structure, restrained axes only; free axes are exactly 0. */
	reaktionenN: Record<string, Vec3>;
	/** Largest unbalanced force at a free degree of freedom. */
	residuumN: number;
	/** Tension-only members that this load case compresses, by ID. */
	schlaff: string[];
};
export type FachwerkErgebnis = { status: 'ok'; loesungen: Loesung[] } | Fehlschlag;

/** Relative slack limit: compression below this share of the load sum is numerical noise. */
const SCHLAFF_ANTEIL = 1e-9;
const vergleiche = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Solution in index order: `ids` ascending, members as passed, three values per node. */
export type Rohloesung = {
	status: 'ok';
	ids: string[];
	fest: Uint8Array;
	/** Per load case: axial force per member, displacement and unbalanced force per node axis. */
	kraefteN: Float64Array[];
	verschiebungenM: Float64Array[];
	resteN: Float64Array[];
};

/**
 * Core solve on canonical input: `staebe` ascending by ID, one summed force per node and load
 * case. Shares one factorization between load cases. Same failures as `loeseFachwerk`, except
 * that load paths are the caller's check.
 */
export function rechneFachwerk(
	knoten: Knoten[],
	staebe: Stab[],
	lager: Lager[],
	lasten: Map<string, Vec3>[]
): Rohloesung | Fehlschlag {
	const ort = new Map(knoten.map((n) => [n.id, n.p]));
	const aktiv = new Set<string>();
	for (const s of staebe) aktiv.add(s.a).add(s.b);
	const ids = [...aktiv].sort();
	const nummer = new Map(ids.map((id, i) => [id, i]));
	const n = ids.length;
	const p = new Float64Array(3 * n);
	for (const [i, id] of ids.entries()) {
		const q = ort.get(id);
		if (!q) return { status: 'eingabe-ungueltig', elementId: id };
		p.set(q, 3 * i);
	}
	const m = staebe.length;
	const ende = new Int32Array(2 * m),
		richtung = new Float64Array(3 * m),
		steife = new Float64Array(m);
	for (let e = 0; e < m; e++) {
		const s = staebe[e],
			a = nummer.get(s.a) as number,
			b = nummer.get(s.b) as number;
		const dx = p[3 * b] - p[3 * a],
			dy = p[3 * b + 1] - p[3 * a + 1],
			dz = p[3 * b + 2] - p[3 * a + 2];
		const laengeM = Math.hypot(dx, dy, dz);
		if (!(laengeM > 0) || !(s.flaecheM2 > 0) || !(s.eModulPa > 0) || !Number.isFinite(laengeM))
			return { status: 'eingabe-ungueltig', elementId: s.id };
		ende[2 * e] = a;
		ende[2 * e + 1] = b;
		richtung.set([dx / laengeM, dy / laengeM, dz / laengeM], 3 * e);
		steife[e] = (s.eModulPa * s.flaecheM2) / laengeM;
	}
	const fest = new Uint8Array(3 * n);
	for (const l of lager) {
		const i = nummer.get(l.knotenId);
		if (i !== undefined) for (let k = 0; k < 3; k++) if (l.fest[k]) fest[3 * i + k] = 1;
	}
	// Number nodes along the longest extent: neighbors stay close, the envelope stays narrow.
	const achse = laengsteAchse(p, n);
	const folge = Array.from({ length: n }, (_, i) => i).sort(
		(a, b) => p[3 * a + achse] - p[3 * b + achse] || a - b
	);
	const dof = new Int32Array(3 * n).fill(-1);
	const knotenVon: number[] = [];
	for (const i of folge)
		for (let k = 0; k < 3; k++)
			if (!fest[3 * i + k]) {
				dof[3 * i + k] = knotenVon.length;
				knotenVon.push(i);
			}
	const start = Int32Array.from(knotenVon, (_, i) => i);
	const stabDof = new Int32Array(6);
	const ladeDof = (e: number) => {
		for (let k = 0; k < 3; k++) {
			stabDof[k] = dof[3 * ende[2 * e] + k];
			stabDof[3 + k] = dof[3 * ende[2 * e + 1] + k];
		}
	};
	for (let e = 0; e < m; e++) {
		ladeDof(e);
		let kleinster = knotenVon.length;
		for (const d of stabDof) if (d >= 0 && d < kleinster) kleinster = d;
		for (const d of stabDof) if (d >= 0 && kleinster < start[d]) start[d] = kleinster;
	}
	const k = huellmatrix(start);
	for (let e = 0; e < m; e++) {
		ladeDof(e);
		for (let i = 0; i < 6; i++) {
			if (stabDof[i] < 0) continue;
			const bi = (i < 3 ? -1 : 1) * richtung[3 * e + (i % 3)];
			for (let j = 0; j <= i; j++) {
				if (stabDof[j] < 0) continue;
				const bj = (j < 3 ? -1 : 1) * richtung[3 * e + (j % 3)];
				addiere(k, stabDof[i], stabDof[j], steife[e] * bi * bj);
			}
		}
	}
	const zerlegung = zerlege(k);
	if (!zerlegung.ok) return { status: 'mechanismus', elementId: ids[knotenVon[zerlegung.zeile]] };

	const kraefteN: Float64Array[] = [],
		verschiebungenM: Float64Array[] = [],
		resteN: Float64Array[] = [];
	for (const lastfall of lasten) {
		const rest = new Float64Array(3 * n);
		for (const [id, kraft] of lastfall) {
			const i = nummer.get(id);
			if (i !== undefined) rest.set(kraft, 3 * i);
		}
		const rechteSeite = new Float64Array(knotenVon.length);
		for (let i = 0; i < 3 * n; i++) if (dof[i] >= 0) rechteSeite[dof[i]] = rest[i];
		const loesung = zerlegung.loese(rechteSeite);
		const u = new Float64Array(3 * n);
		for (let i = 0; i < 3 * n; i++) if (dof[i] >= 0) u[i] = loesung[dof[i]];
		const kraft = new Float64Array(m);
		for (let e = 0; e < m; e++) {
			const a = 3 * ende[2 * e],
				b = 3 * ende[2 * e + 1],
				r = 3 * e;
			const dehnung =
				richtung[r] * (u[b] - u[a]) +
				richtung[r + 1] * (u[b + 1] - u[a + 1]) +
				richtung[r + 2] * (u[b + 2] - u[a + 2]);
			kraft[e] = steife[e] * dehnung;
			// A member in tension pulls its end nodes towards each other.
			for (let i = 0; i < 3; i++) {
				rest[a + i] += kraft[e] * richtung[r + i];
				rest[b + i] -= kraft[e] * richtung[r + i];
			}
		}
		kraefteN.push(kraft);
		verschiebungenM.push(u);
		resteN.push(rest);
	}
	return { status: 'ok', ids, fest, kraefteN, verschiebungenM, resteN };
}

/** One summed force per node; summation order is canonical, so permuted lists sum bit-identically. */
export function knotenlasten(lasten: Lastfall['lasten']): Map<string, Vec3> {
	const sortiert = [...lasten].sort(
		(a, b) =>
			vergleiche(a.knotenId, b.knotenId) ||
			a.kraftN[0] - b.kraftN[0] ||
			a.kraftN[1] - b.kraftN[1] ||
			a.kraftN[2] - b.kraftN[2]
	);
	const summe = new Map<string, Vec3>();
	for (const l of sortiert) {
		const alt = summe.get(l.knotenId) ?? [0, 0, 0];
		summe.set(l.knotenId, [alt[0] + l.kraftN[0], alt[1] + l.kraftN[1], alt[2] + l.kraftN[2]]);
	}
	return summe;
}

/**
 * Solves all load cases on one factorization.
 *
 * Input order is irrelevant: nodes and members are processed by ID and results are keyed by ID in
 * ascending order. Nodes without members take no part. Results are detached. Failures:
 * `eingabe-ungueltig` (unknown node, zero length, non-positive area, non-finite value),
 * `lastpfad-fehlt` (a loaded node has no member or reaches no bearing), `mechanismus` (singular
 * stiffness; `elementId` names a node that can move freely).
 */
export function loeseFachwerk(f: Fachwerk, lastfaelle: Lastfall[]): FachwerkErgebnis {
	const staebe = [...f.staebe].sort((a, b) => vergleiche(a.id, b.id));
	const ort = new Set(f.knoten.map((n) => n.id));
	const fremd = staebe.find((s) => !ort.has(s.a) || !ort.has(s.b));
	if (fremd) return { status: 'eingabe-ungueltig', elementId: fremd.id };
	const lastpfad = pruefeLastpfad(staebe, f.lager, lastfaelle);
	if (lastpfad) return lastpfad;
	const lasten = lastfaelle.map((l) => knotenlasten(l.lasten));
	const roh = rechneFachwerk(f.knoten, staebe, f.lager, lasten);
	if (roh.status !== 'ok') return roh;
	const vec = (werte: Float64Array, i: number): Vec3 => [
		werte[3 * i],
		werte[3 * i + 1],
		werte[3 * i + 2]
	];
	const loesungen = lastfaelle.map((lastfall, l): Loesung => {
		let lastsumme = 0;
		for (const kraft of lasten[l].values()) for (const v of kraft) lastsumme += Math.abs(v);
		const stabkraefteN: Record<string, number> = {};
		const schlaff: string[] = [];
		staebe.forEach((s, e) => {
			const kraft = roh.kraefteN[l][e];
			stabkraefteN[s.id] = kraft;
			if (s.nurZug && kraft < -SCHLAFF_ANTEIL * Math.max(1, lastsumme)) schlaff.push(s.id);
		});
		let residuumN = 0;
		const reaktionenN: Record<string, Vec3> = {};
		const verschiebungenM: Record<string, Vec3> = {};
		roh.ids.forEach((id, i) => {
			verschiebungenM[id] = vec(roh.verschiebungenM[l], i);
			const gehalten = [0, 1, 2].map((k) => roh.fest[3 * i + k] === 1);
			const rest = vec(roh.resteN[l], i);
			for (let k = 0; k < 3; k++)
				if (!gehalten[k]) residuumN = Math.max(residuumN, Math.abs(rest[k]));
			if (gehalten.some(Boolean))
				reaktionenN[id] = rest.map((v, k) => (gehalten[k] && v !== 0 ? -v : 0)) as Vec3;
		});
		return {
			lastfallId: lastfall.id,
			verschiebungenM,
			stabkraefteN,
			reaktionenN,
			residuumN,
			schlaff
		};
	});
	return { status: 'ok', loesungen };
}

/** Graph part of the load path: every loaded node has members and reaches a restrained node. */
export function pruefeLastpfad(
	staebe: { a: string; b: string }[],
	lager: Lager[],
	lastfaelle: Lastfall[]
): Fehlschlag | undefined {
	const belastet = [
		...new Set(
			lastfaelle.flatMap((l) =>
				l.lasten.filter((x) => x.kraftN.some((v) => v !== 0)).map((x) => x.knotenId)
			)
		)
	].sort();
	const nachbarn = new Map<string, string[]>();
	for (const s of staebe) {
		nachbarn.set(s.a, [...(nachbarn.get(s.a) ?? []), s.b]);
		nachbarn.set(s.b, [...(nachbarn.get(s.b) ?? []), s.a]);
	}
	const getragen = new Set<string>();
	const offen = lager.map((l) => l.knotenId).filter((id) => nachbarn.has(id));
	for (const id of offen) getragen.add(id);
	for (let id = offen.pop(); id !== undefined; id = offen.pop())
		for (const n of nachbarn.get(id) ?? [])
			if (!getragen.has(n)) {
				getragen.add(n);
				offen.push(n);
			}
	const lose = belastet.find((id) => !getragen.has(id));
	return lose === undefined ? undefined : { status: 'lastpfad-fehlt', elementId: lose };
}

function laengsteAchse(p: Float64Array, n: number): number {
	let achse = 0,
		weite = -1;
	for (let k = 0; k < 3; k++) {
		let min = Infinity,
			max = -Infinity;
		for (let i = 0; i < n; i++) {
			min = Math.min(min, p[3 * i + k]);
			max = Math.max(max, p[3 * i + k]);
		}
		if (max - min > weite) {
			weite = max - min;
			achse = k;
		}
	}
	return achse;
}
