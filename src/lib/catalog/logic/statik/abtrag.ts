/**
 * Form from simulation: start with a full grid of candidate members, compute the forces, give
 * every member the area its force needs, then take away the members that carry least. A removal
 * stays if the rest still stands and needs no more steel than before. Repeat until every further
 * removal would cost stability or material. This is the truss analogue of "simulate a large
 * part, then remove what is not needed" (fully stressed sizing with greedy removal).
 *
 * A descent, no proof of minimum mass. Headless, deterministic, step budgets only.
 */
import {
	ausnutzung,
	bedarfM2,
	bemesse,
	KATALOG_FEIN,
	KLEINSTER_QUERSCHNITT,
	type Katalog,
	type Querschnitt
} from './bemessung';
import {
	knotenlasten,
	pruefeLastpfad,
	rechneFachwerk,
	type Rohloesung,
	type Stab
} from './fachwerk';
import {
	ERDBESCHLEUNIGUNG_M_S2,
	type Fehlschlag,
	type Knoten,
	type Lager,
	type Lastfall,
	type Vec3,
	type Werkstoff
} from './modell';

/**
 * `tragstab`: sized for tension and compression. `haenger`: tension only. `starr`: an idealized
 * rigid link of a body that is carried (never sized, never removed, not part of the result).
 *
 * `gruppe`: members of one group are the same part, e.g. mirror images. They are sized for the
 * largest force any of them sees and leave together, so a mirrored grid stays mirrored even where
 * a bearing or a load case is not.
 */
export type Kandidat = {
	id: string;
	a: string;
	b: string;
	rolle: 'tragstab' | 'haenger' | 'starr';
	gruppe?: string;
	/** Keep this member and its whole group during removal, including node peeling.
	 * Does not override stability, sizing or the built inventory in `nachweis`. */
	bleibt?: boolean;
	/** `starr` only: area of a link that is merely stiff instead of rigid, m². */
	flaecheM2?: number;
	/**
	 * `haenger` only: tension the rod is tightened to when it is built, newtons. A load case may
	 * relieve it by up to this much without slack; the rod is sized for its force plus this.
	 */
	vorspannungN?: number;
};
/**
 * The same structure with some nodes and every member at them absent, under its own load cases:
 * a carrier before its load is hung in. Members are sized for all states; a grid that only
 * stands with the absent part is a mechanism.
 */
export type Zustand = { ohneKnoten: string[]; lastfaelle: Lastfall[] };
export type Aufgabe = {
	knoten: Knoten[];
	/** Unordered candidate set; processed by ID. */
	kandidaten: Kandidat[];
	lager: Lager[];
	/** All sized members satisfy every load case (envelope). */
	lastfaelle: Lastfall[];
	werkstoff: Werkstoff;
	/** Serviceability: largest vertical displacement of this load case stays within the limit. */
	gebrauch?: { lastfallId: string; grenzeM: number };
	zustaende?: Zustand[];
};
/**
 * `kraefte`: size the full grid, remove nothing. `abtrag`: remove until nothing more can go.
 * `nachweis`: change nothing; check the members of `Optionen.querschnitte` as they are.
 */
export type Stufe = 'kraefte' | 'abtrag' | 'nachweis';
export type Optionen = {
	stufe?: Stufe;
	/** Sections to choose from; default `KATALOG_FEIN`. */
	katalog?: Katalog;
	/**
	 * `nachweis` only: the built sections by member ID. Candidates without one are absent. A rod
	 * cannot push: one that a load case compresses goes slack and is reported as `schlaff`.
	 */
	querschnitte?: Record<string, Querschnitt>;
	/**
	 * Tolerated growth of steel mass against the lightest state seen, as a share. A little slack
	 * prefers fewer members over the last kilogram.
	 */
	nachsicht?: number;
};
export type BemessenerStab = {
	id: string;
	a: string;
	b: string;
	rolle: 'tragstab' | 'haenger';
	laengeM: number;
	querschnitt: Querschnitt;
	/** Largest tension and largest compression over all load cases, both ≥ 0. */
	zugN: number;
	druckN: number;
	ausnutzung: number;
	/** `nachweis`: a rod that went slack; it carries nothing in this check. */
	schlaff?: true;
};
export type Kennzahlen = {
	kandidaten: number;
	staebe: number;
	masseKg: number;
	/** Solver runs spent, a deterministic work count. */
	laeufe: number;
	ausnutzungMax: number;
	durchbiegungM: number;
	groessterZugN: number;
	groessterDruckN: number;
	/** Remaining members that no load case uses; they only keep a node in place. */
	nullstaebe: number;
	residuumN: number;
};
export type Tragwerk =
	| {
			status: 'ok';
			/** Remaining sized members by ID, without rigid links. */
			staebe: BemessenerStab[];
			/** Bearing forces per load case ID and node ID. */
			reaktionenN: Record<string, Record<string, Vec3>>;
			/** Node displacements of the serviceability load case by node ID; empty without one. */
			verschiebungenM: Record<string, Vec3>;
			kennzahlen: Kennzahlen;
	  }
	| Fehlschlag;

const NACHSICHT = 0.02;
/** Forces below this share of the reference load count as zero. */
const NULLKRAFT_ANTEIL = 1e-6;
/** Member forces closer than this share are a tie and leave together: symmetry survives. */
const GLEICHSTAND_ANTEIL = 1e-6;
/** Area of a rigid link, m²: two orders stiffer than a heavy member, well conditioned. */
const STARR_FLAECHE_M2 = 0.05;
const START_FLAECHE_M2 = 1e-3;
/**
 * Floor of the continuous area while forces redistribute, m². Far below any real section, so an
 * unneeded member fades out instead of attracting force through its stiffness.
 */
const SCHWUND_FLAECHE_M2 = 1e-7;
/** First removal attempt takes this share of the weakest members at once. */
const ABTRAG_ANTEIL = 0.25;
/** Step budgets (PD-12): sizing passes at the start and per attempt, attempts, catalog passes. */
const ANGLEICH_BUDGET = 40;
const VERSUCH_BUDGET = 6;
const ANGLEICH_TOLERANZ = 1e-3;
const ABTRAG_BUDGET = 400;
const RUNDEN_BUDGET = 8;
const KATALOG_BUDGET = 24;

type Stand = {
	status: 'ok';
	roh: Rohloesung;
	/** Largest tension and compression per member, in member order. */
	zugN: Float64Array;
	druckN: Float64Array;
};
type Verstoss = { art: 'haenger' | 'lager'; id: string; betragN: number };

/**
 * Sizes and thins out a candidate grid. Input is not mutated, the result is detached. Order of
 * nodes, candidates, bearings and loads is irrelevant; ties are decided by ID.
 *
 * One-sided parts are resolved before anything is removed: a hanger that some load case
 * compresses and a pressure-only bearing that some load case lifts drop out, worst first, until
 * the linear model holds for every load case.
 *
 * Failures: those of `loeseFachwerk` for the full grid, `zugstab-unter-druck` and `lager-hebt-ab`
 * (the structure only stands with a pushing hanger or a pulling bearing), `nicht-bemessbar`
 * (catalog or step budget exhausted).
 */
export function abtragen(aufgabe: Aufgabe, optionen: Optionen = {}): Tragwerk {
	const { werkstoff } = aufgabe;
	const stufe = optionen.stufe ?? 'abtrag';
	const gebaut = stufe === 'nachweis' ? (optionen.querschnitte ?? {}) : undefined;
	const katalog = optionen.katalog ?? KATALOG_FEIN;
	const ort = new Map(aufgabe.knoten.map((n) => [n.id, n.p]));
	let staebe = [...aufgabe.kandidaten]
		.filter((s) => !gebaut || s.rolle === 'starr' || gebaut[s.id])
		// A built rod has no compression capacity: it is one-sided like a hanger.
		.map((s) => (gebaut?.[s.id]?.art === 'rundstab' ? { ...s, rolle: 'haenger' as const } : s))
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const alle = staebe;
	const gruppeVon = (s: Kandidat) => s.gruppe ?? s.id;
	const bleibendeGruppen = new Set(staebe.filter((s) => s.bleibt).map(gruppeVon));
	const bleibt = (s: Kandidat) => bleibendeGruppen.has(gruppeVon(s));
	const bleibende = staebe.filter(bleibt);
	const fehltBleibender = (rest: Kandidat[]) => {
		const ids = new Set(rest.map((s) => s.id));
		return bleibende.find((s) => !ids.has(s.id));
	};
	let lager = [...aufgabe.lager].sort((a, b) => (a.knotenId < b.knotenId ? -1 : 1));
	const laenge = new Map<string, number>();
	for (const s of staebe) {
		const a = ort.get(s.a),
			b = ort.get(s.b);
		if (!a || !b) return { status: 'eingabe-ungueltig', elementId: s.id };
		laenge.set(s.id, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
	}
	const laengeVon = (id: string) => laenge.get(id) ?? 0;
	const basis = aufgabe.lastfaelle.map((l) => knotenlasten(l.lasten));
	const bezugN = Math.max(
		1,
		...basis.map((l) => [...l.values()].reduce((s, k) => s + Math.hypot(k[0], k[1], k[2]), 0))
	);
	const nullN = NULLKRAFT_ANTEIL * bezugN;
	let flaeche = new Map(
		staebe.map((s) => [
			s.id,
			s.rolle === 'starr'
				? (s.flaecheM2 ?? STARR_FLAECHE_M2)
				: (gebaut?.[s.id]?.flaecheM2 ?? START_FLAECHE_M2)
		])
	);
	let laeufe = 0;
	const zustaende = (aufgabe.zustaende ?? []).map((z) => ({
		fehlt: new Set(z.ohneKnoten),
		lastfaelle: z.lastfaelle,
		basis: z.lastfaelle.map((l) => knotenlasten(l.lasten))
	}));
	/** Node loads per load case with member self weight, half to each end; follows the areas. */
	function mitEigengewicht(
		lastfaelle: Lastfall[],
		grund: Map<string, Vec3>[],
		aktive: Kandidat[],
		areas: Map<string, number>
	) {
		return lastfaelle.map((lastfall, l) => {
			const g = lastfall.eigengewichtG;
			if (!g) return grund[l];
			const summe = new Map(grund[l]);
			for (const s of aktive) {
				if (s.rolle === 'starr') continue;
				const halbN =
					((areas.get(s.id) ?? 0) *
						laengeVon(s.id) *
						werkstoff.dichteKgM3 *
						ERDBESCHLEUNIGUNG_M_S2) /
					2;
				for (const id of [s.a, s.b]) {
					const alt = summe.get(id) ?? [0, 0, 0];
					summe.set(id, [alt[0] + g[0] * halbN, alt[1] + g[1] * halbN, alt[2] + g[2] * halbN]);
				}
			}
			return summe;
		});
	}
	const alsStab =
		(areas: Map<string, number>) =>
		(s: Kandidat): Stab => ({
			id: s.id,
			a: s.a,
			b: s.b,
			flaecheM2: areas.get(s.id) ?? START_FLAECHE_M2,
			eModulPa: werkstoff.eModulPa
		});

	function rechne(aktive: Kandidat[], areas: Map<string, number>, auflager: Lager[]) {
		laeufe++;
		const lastpfad = pruefeLastpfad(aktive, auflager, aufgabe.lastfaelle);
		if (lastpfad) return lastpfad;
		const roh = rechneFachwerk(
			aufgabe.knoten,
			aktive.map(alsStab(areas)),
			auflager,
			mitEigengewicht(aufgabe.lastfaelle, basis, aktive, areas)
		);
		if (roh.status !== 'ok') return roh;
		const zugN = new Float64Array(aktive.length),
			druckN = new Float64Array(aktive.length);
		const huelle = (kraefteN: Float64Array[], index?: number[]) => {
			for (const kraefte of kraefteN)
				for (let i = 0; i < kraefte.length; i++) {
					const e = index ? index[i] : i;
					if (kraefte[i] > zugN[e]) zugN[e] = kraefte[i];
					if (-kraefte[i] > druckN[e]) druckN[e] = -kraefte[i];
				}
		};
		huelle(roh.kraefteN);
		for (const z of zustaende) {
			laeufe++;
			const index: number[] = [];
			aktive.forEach((s, e) => {
				if (!z.fehlt.has(s.a) && !z.fehlt.has(s.b)) index.push(e);
			});
			const teil = index.map((e) => aktive[e]);
			const ohne = rechneFachwerk(
				aufgabe.knoten,
				teil.map(alsStab(areas)),
				auflager,
				mitEigengewicht(z.lastfaelle, z.basis, teil, areas)
			);
			if (ohne.status !== 'ok') return ohne;
			huelle(ohne.kraefteN, index);
		}
		for (const [e, s] of aktive.entries()) {
			if (s.rolle === 'haenger' && s.vorspannungN) {
				druckN[e] = Math.max(0, druckN[e] - s.vorspannungN);
				zugN[e] += s.vorspannungN;
			}
			if (druckN[e] <= nullN) druckN[e] = 0;
		}
		// One part, one force: every member of a group gets the largest envelope in the group.
		const jeGruppe = new Map<string, [number, number]>();
		for (const [e, s] of aktive.entries()) {
			const alt = jeGruppe.get(gruppeVon(s));
			if (!alt) jeGruppe.set(gruppeVon(s), [zugN[e], druckN[e]]);
			else {
				alt[0] = Math.max(alt[0], zugN[e]);
				alt[1] = Math.max(alt[1], druckN[e]);
			}
		}
		for (const [e, s] of aktive.entries())
			[zugN[e], druckN[e]] = jeGruppe.get(gruppeVon(s)) as [number, number];
		const stand: Stand = { status: 'ok', roh, zugN, druckN };
		return stand;
	}
	/** Fully stressed sizing: every member gets the area its envelope force needs. Mutates `areas`. */
	function angleichen(
		aktive: Kandidat[],
		areas: Map<string, number>,
		auflager: Lager[],
		budget: number
	) {
		let stand = rechne(aktive, areas, auflager);
		for (let schritt = 0; schritt < budget && stand.status === 'ok'; schritt++) {
			let aenderung = 0;
			for (const [e, s] of aktive.entries()) {
				if (s.rolle === 'starr') continue;
				const druckN = s.rolle === 'haenger' ? 0 : stand.druckN[e];
				const bedarf = Math.max(
					SCHWUND_FLAECHE_M2,
					bedarfM2(laengeVon(s.id), stand.zugN[e], druckN, werkstoff)
				);
				const alt = areas.get(s.id) ?? bedarf;
				aenderung = Math.max(aenderung, Math.abs(bedarf - alt) / Math.max(bedarf, alt));
				areas.set(s.id, bedarf);
			}
			if (aenderung <= ANGLEICH_TOLERANZ) break;
			stand = rechne(aktive, areas, auflager);
		}
		return stand;
	}
	/** Worst one-sided part that is loaded the wrong way round; ties by ID. */
	function verstoss(aktive: Kandidat[], auflager: Lager[], stand: Stand): Verstoss | undefined {
		let schlimmster: Verstoss | undefined;
		const melde = (v: Verstoss) => {
			if (v.betragN <= nullN) return;
			if (
				!schlimmster ||
				v.betragN > schlimmster.betragN ||
				(v.betragN === schlimmster.betragN && v.id < schlimmster.id)
			)
				schlimmster = v;
		};
		for (const [e, s] of aktive.entries())
			if (s.rolle === 'haenger') melde({ art: 'haenger', id: s.id, betragN: stand.druckN[e] });
		for (const l of auflager) {
			const i = l.nurDruck && l.fest[2] ? stand.roh.ids.indexOf(l.knotenId) : -1;
			if (i < 0) continue;
			// Unbalanced force at a held axis is minus the bearing force: positive z pulls down.
			const zieht = Math.max(...stand.roh.resteN.map((rest) => rest[3 * i + 2]));
			melde({ art: 'lager', id: l.knotenId, betragN: zieht });
		}
		return schlimmster;
	}
	const gebrauch = aufgabe.lastfaelle.findIndex((l) => l.id === aufgabe.gebrauch?.lastfallId);
	/** Largest vertical displacement of the serviceability load case, meters. */
	function durchbiegung(stand: Stand): number {
		let groesste = 0;
		if (gebrauch < 0) return groesste;
		const u = stand.roh.verschiebungenM[gebrauch];
		for (let i = 2; i < u.length; i += 3) groesste = Math.max(groesste, Math.abs(u[i]));
		return groesste;
	}
	/**
	 * Steel a state needs for strength and stiffness, kg. No real member is thinner than the
	 * smallest catalog rod; a state that sags too much pays with proportionally more area.
	 */
	function stahlKg(aktive: Kandidat[], areas: Map<string, number>, stand: Stand): number {
		let kg = 0;
		for (const s of aktive)
			if (s.rolle !== 'starr')
				kg +=
					Math.max(areas.get(s.id) ?? 0, KLEINSTER_QUERSCHNITT.flaecheM2) *
					laengeVon(s.id) *
					werkstoff.dichteKgM3;
		const zuWeich = aufgabe.gebrauch ? durchbiegung(stand) / aufgabe.gebrauch.grenzeM : 0;
		return kg * Math.max(1, zuWeich);
	}

	/** `nachweis` leaves the built sections alone; otherwise every member is sized to its force. */
	const loese = (aktive: Kandidat[], areas: Map<string, number>, auflager: Lager[]) =>
		gebaut ? rechne(aktive, areas, auflager) : angleichen(aktive, areas, auflager, ANGLEICH_BUDGET);
	staebe = ohneHaltlose(staebe, ort, lager);
	const fehlt = fehltBleibender(staebe);
	if (fehlt) return { status: 'mechanismus', elementId: fehlt.id };
	let stand = loese(staebe, flaeche, lager);
	for (let schritt = 0; schritt < aufgabe.kandidaten.length + aufgabe.lager.length; schritt++) {
		if (stand.status !== 'ok') return stand;
		const v = verstoss(staebe, lager, stand);
		if (!v) break;
		if (v.art === 'haenger') {
			const gruppe = gruppeVon(staebe.find((s) => s.id === v.id) as Kandidat);
			if (bleibendeGruppen.has(gruppe)) return { status: 'zugstab-unter-druck', elementId: v.id };
			staebe = staebe.filter((s) => gruppeVon(s) !== gruppe);
		}
		// A lifting shoe stops carrying; a shear key at the same node keeps holding sideways.
		else
			lager = lager
				.map((l) =>
					l.knotenId === v.id ? { ...l, fest: [l.fest[0], l.fest[1], false] as Lager['fest'] } : l
				)
				.filter((l) => l.fest.some(Boolean));
		staebe = ohneHaltlose(staebe, ort, lager);
		const fehlt = fehltBleibender(staebe);
		if (fehlt)
			return {
				status: v.art === 'haenger' ? 'zugstab-unter-druck' : 'lager-hebt-ab',
				elementId: v.id
			};
		const naechster = loese(staebe, flaeche, lager);
		if (naechster.status !== 'ok')
			return {
				status: v.art === 'haenger' ? 'zugstab-unter-druck' : 'lager-hebt-ab',
				elementId: v.id
			};
		stand = naechster;
	}
	if (stand.status !== 'ok') return stand;

	if (stufe === 'abtrag') {
		const nachsicht = optionen.nachsicht ?? NACHSICHT;
		let leichtesteKg = stahlKg(staebe, flaeche, stand);
		let versuche = 0;
		const starreKnoten = new Set(
			staebe.filter((s) => s.rolle === 'starr').flatMap((s) => [s.a, s.b])
		);
		/** Takes `weg` and what loses its hold with it; keeps the change if nothing gets worse. */
		const probiere = (weg: Set<string>): boolean => {
			versuche++;
			const gruppen = new Set(staebe.filter((s) => weg.has(s.id)).map(gruppeVon));
			if ([...gruppen].some((g) => bleibendeGruppen.has(g))) return false;
			const rest = ohneHaltlose(
				staebe.filter((s) => s.rolle === 'starr' || !gruppen.has(gruppeVon(s))),
				ort,
				lager
			);
			if (fehltBleibender(rest)) return false;
			const probe = new Map(flaeche);
			const naechster = angleichen(rest, probe, lager, VERSUCH_BUDGET);
			if (naechster.status !== 'ok' || verstoss(rest, lager, naechster)) return false;
			const kg = stahlKg(rest, probe, naechster);
			if (kg > leichtesteKg * (1 + nachsicht)) return false;
			staebe = rest;
			flaeche = probe;
			stand = naechster;
			leichtesteKg = Math.min(leichtesteKg, kg);
			return true;
		};
		/** Largest envelope force per member of the current state. */
		const kraefte = () => {
			const jetzt = stand as Stand;
			return new Map(staebe.map((s, e) => [s.id, Math.max(jetzt.zugN[e], jetzt.druckN[e])]));
		};
		/** Ascending by force, split into ties: a tie leaves together, so symmetry survives. */
		const inGruppen = <T extends { id: string; kraftN: number }>(liste: T[]): T[][] => {
			const sortiert = [...liste].sort((a, b) => a.kraftN - b.kraftN || (a.id < b.id ? -1 : 1));
			const gruppen: T[][] = [];
			for (const x of sortiert) {
				const letzte = gruppen[gruppen.length - 1];
				const vorher = letzte?.[letzte.length - 1];
				if (vorher && x.kraftN - vorher.kraftN <= GLEICHSTAND_ANTEIL * Math.max(nullN, x.kraftN))
					letzte.push(x);
				else gruppen.push([x]);
			}
			return gruppen;
		};
		/** Joints go as a whole, weakest first; one sweep. A joint is as strong as its strongest member. */
		const knotenAbtragen = (): boolean => {
			const kraft = kraefte();
			const jeKnoten = new Map<string, number>();
			for (const s of staebe)
				for (const id of [s.a, s.b])
					if (!starreKnoten.has(id))
						jeKnoten.set(id, Math.max(jeKnoten.get(id) ?? 0, kraft.get(s.id) ?? 0));
			let entfallen = false;
			for (const gruppe of inGruppen([...jeKnoten].map(([id, kraftN]) => ({ id, kraftN })))) {
				if (versuche >= ABTRAG_BUDGET) break;
				const knoten = new Set(gruppe.map((x) => x.id));
				const weg = new Set(
					staebe.filter((s) => knoten.has(s.a) || knoten.has(s.b)).map((s) => s.id)
				);
				if (weg.size && probiere(weg)) entfallen = true;
			}
			return entfallen;
		};
		/** Members: the weakest share leaves together; the share halves whenever that fails. */
		const staebeAbtragen = () => {
			const gebraucht = new Set<string>();
			let anteil = ABTRAG_ANTEIL;
			while (versuche < ABTRAG_BUDGET) {
				const kraft = kraefte();
				const gruppen = inGruppen(
					staebe
						.filter((s) => s.rolle !== 'starr' && !bleibt(s) && !gebraucht.has(s.id))
						.map((s) => ({ id: s.id, kraftN: kraft.get(s.id) ?? 0 }))
				);
				if (!gruppen.length) break;
				const anzahl = Math.ceil(anteil * gruppen.reduce((n, g) => n + g.length, 0));
				const weg = new Set<string>();
				for (const g of gruppen) {
					if (weg.size >= anzahl) break;
					for (const x of g) weg.add(x.id);
				}
				if (probiere(weg)) continue;
				if (weg.size === gruppen[0].length) for (const id of weg) gebraucht.add(id);
				else anteil /= 2;
			}
		};
		// Joints first: while the grid is still redundant a whole joint can go. Single members
		// follow; they end in a state where every member is needed to stand.
		for (let runde = 0; runde < RUNDEN_BUDGET && knotenAbtragen(); runde++);
		staebeAbtragen();
		knotenAbtragen();
	}

	// Catalog sections: only ever grow, so the loop ends.
	const querschnitt = new Map<string, Querschnitt>(gebaut ? Object.entries(gebaut) : []);
	let fertig = !!gebaut;
	let durchbiegungM = durchbiegung(stand);
	for (let schritt = 0; schritt < KATALOG_BUDGET && !fertig; schritt++) {
		fertig = true;
		const v = verstoss(staebe, lager, stand);
		if (v)
			return {
				status: v.art === 'haenger' ? 'zugstab-unter-druck' : 'lager-hebt-ab',
				elementId: v.id
			};
		durchbiegungM = durchbiegung(stand);
		const zuWeich = aufgabe.gebrauch ? durchbiegungM / aufgabe.gebrauch.grenzeM : 0;
		for (const [e, s] of staebe.entries()) {
			if (s.rolle === 'starr') continue;
			const alt = querschnitt.get(s.id);
			const druckN = alt?.art === 'rohr' && stand.druckN[e] === 0 ? nullN : stand.druckN[e];
			const genug =
				alt &&
				zuWeich <= 1 &&
				ausnutzung(alt, laengeVon(s.id), stand.zugN[e], druckN, werkstoff) <= 1;
			if (genug) continue;
			const mindestM2 = (alt?.flaecheM2 ?? 0) * Math.max(1, zuWeich);
			const neu = bemesse(laengeVon(s.id), stand.zugN[e], druckN, werkstoff, mindestM2, katalog);
			if (!neu) return { status: 'nicht-bemessbar', elementId: s.id };
			querschnitt.set(s.id, neu);
			flaeche.set(s.id, neu.flaecheM2);
			fertig = false;
		}
		if (fertig) break;
		const naechster = rechne(staebe, flaeche, lager);
		if (naechster.status !== 'ok') return naechster;
		stand = naechster;
	}
	const schluss = stand;
	if (!fertig) return { status: 'nicht-bemessbar', elementId: staebe[0]?.id ?? '' };

	const ergebnis: BemessenerStab[] = [];
	for (const [e, s] of staebe.entries()) {
		if (s.rolle === 'starr') continue;
		const q = querschnitt.get(s.id) ?? KLEINSTER_QUERSCHNITT;
		ergebnis.push({
			id: s.id,
			a: s.a,
			b: s.b,
			rolle: s.rolle,
			laengeM: laengeVon(s.id),
			querschnitt: q,
			zugN: schluss.zugN[e],
			druckN: schluss.druckN[e],
			ausnutzung: ausnutzung(q, laengeVon(s.id), schluss.zugN[e], schluss.druckN[e], werkstoff)
		});
	}
	if (gebaut) {
		const dabei = new Set(staebe.map((s) => s.id));
		for (const s of alle)
			if (s.rolle !== 'starr' && !dabei.has(s.id))
				ergebnis.push({
					id: s.id,
					a: s.a,
					b: s.b,
					rolle: s.rolle,
					laengeM: laengeVon(s.id),
					querschnitt: gebaut[s.id],
					zugN: 0,
					druckN: 0,
					ausnutzung: 0,
					schlaff: true
				});
		ergebnis.sort((a, b) => (a.id < b.id ? -1 : 1));
	}
	const { roh } = schluss;
	let residuumN = 0;
	for (const rest of roh.resteN)
		for (let i = 0; i < rest.length; i++)
			if (!roh.fest[i]) residuumN = Math.max(residuumN, Math.abs(rest[i]));
	const reaktionenN: Record<string, Record<string, Vec3>> = {};
	[...aufgabe.lastfaelle.entries()]
		.sort((a, b) => (a[1].id < b[1].id ? -1 : 1))
		.forEach(([l, lastfall]) => {
			const jeLager: Record<string, Vec3> = {};
			for (const lagerung of lager) {
				const i = roh.ids.indexOf(lagerung.knotenId);
				if (i < 0) continue;
				jeLager[lagerung.knotenId] = [0, 1, 2].map((k) => {
					const rest = roh.resteN[l][3 * i + k];
					return roh.fest[3 * i + k] && rest !== 0 ? -rest : 0;
				}) as Vec3;
			}
			reaktionenN[lastfall.id] = jeLager;
		});
	const verschiebungenM: Record<string, Vec3> = {};
	if (gebrauch >= 0) {
		const u = roh.verschiebungenM[gebrauch];
		roh.ids.forEach((id, i) => (verschiebungenM[id] = [u[3 * i], u[3 * i + 1], u[3 * i + 2]]));
	}
	return {
		status: 'ok',
		staebe: ergebnis,
		reaktionenN,
		verschiebungenM,
		kennzahlen: {
			kandidaten: aufgabe.kandidaten.filter((k) => k.rolle !== 'starr').length,
			staebe: ergebnis.length,
			masseKg: ergebnis.reduce(
				(m, s) => m + s.querschnitt.flaecheM2 * s.laengeM * werkstoff.dichteKgM3,
				0
			),
			laeufe,
			ausnutzungMax: Math.max(0, ...ergebnis.map((s) => s.ausnutzung)),
			durchbiegungM,
			groessterZugN: Math.max(0, ...ergebnis.map((s) => s.zugN)),
			groessterDruckN: Math.max(0, ...ergebnis.map((s) => s.druckN)),
			nullstaebe: ergebnis.filter((s) => Math.max(s.zugN, s.druckN) <= nullN).length,
			residuumN
		}
	};
}

/** Directions closer to a plane or line than this (unit vectors) count as dependent. */
const RANG_TOLERANZ = 1e-6;

/**
 * Peels off what the grid cannot hold: a node needs members in as many independent directions as
 * it has free axes. Members at a node that fails are dropped, then the neighbors are checked
 * again. Necessary, not sufficient: the solver still decides about mechanisms.
 */
function ohneHaltlose(staebe: Kandidat[], ort: Map<string, Vec3>, lager: Lager[]): Kandidat[] {
	const fest = new Map<string, [boolean, boolean, boolean]>();
	for (const l of lager) {
		const alt = fest.get(l.knotenId) ?? [false, false, false];
		fest.set(l.knotenId, [alt[0] || l.fest[0], alt[1] || l.fest[1], alt[2] || l.fest[2]]);
	}
	let rest = staebe;
	for (;;) {
		const richtungen = new Map<string, Vec3[]>();
		for (const s of rest) {
			const a = ort.get(s.a) as Vec3,
				b = ort.get(s.b) as Vec3;
			for (const id of [s.a, s.b]) {
				const frei = fest.get(id) ?? [false, false, false];
				const d = [0, 1, 2].map((i) => (frei[i] ? 0 : b[i] - a[i])) as Vec3;
				richtungen.set(id, [...(richtungen.get(id) ?? []), d]);
			}
		}
		const haltlos = new Set<string>();
		for (const [id, ds] of richtungen) {
			const frei = (fest.get(id) ?? [false, false, false]).filter((f) => !f).length;
			if (rang(ds) < frei) haltlos.add(id);
		}
		if (!haltlos.size) return rest;
		rest = rest.filter((s) => !haltlos.has(s.a) && !haltlos.has(s.b));
	}
}

/** Number of independent directions by Gram–Schmidt on unit vectors. */
function rang(richtungen: Vec3[]): number {
	const basis: Vec3[] = [];
	for (const r of richtungen) {
		const laenge = Math.hypot(r[0], r[1], r[2]);
		if (laenge === 0) continue;
		const v: Vec3 = [r[0] / laenge, r[1] / laenge, r[2] / laenge];
		for (const b of basis) {
			const anteil = v[0] * b[0] + v[1] * b[1] + v[2] * b[2];
			for (let i = 0; i < 3; i++) v[i] -= anteil * b[i];
		}
		const restlaenge = Math.hypot(v[0], v[1], v[2]);
		if (restlaenge <= RANG_TOLERANZ) continue;
		basis.push([v[0] / restlaenge, v[1] / restlaenge, v[2] / restlaenge]);
		if (basis.length === 3) break;
	}
	return basis.length;
}
