/**
 * Hanging house in a gap. The house brings its own lattice: axis-parallel to the span, centered
 * over the gap, mirrored about midspan and about the capsule axis. The structural simulation
 * takes away what is not needed and keeps the mirror symmetry, because mirror images are one
 * part (`Kandidat.gruppe`). Bearings sit on the party-wall crowns at eight meters, the capsule
 * hangs on rods that run outside its shell down to the floor, the roof garden is a load.
 *
 * Pipeline: seed → parameters → stock → lattice → capsule and clear spaces → load cases →
 * removal → carrier plan with sized members. A change of occupancy does not change the form:
 * `nachrechnen` checks the built members under the new load. Demo loads, no code check
 * (docs/research/122, appendix C).
 */
import type { FlowId } from '../../data/focus';
import { hashUnit } from '../parzelle/zufall';
import { kantenId, type Kante, type Knoten, type TraegerPlan, type Vec3 } from '../traeger/plan';
import {
	abtragen,
	KATALOG_RUHIG,
	rohr,
	rundstab,
	STAHL,
	type Aufgabe,
	type Kandidat,
	type Lastfall,
	type Querschnitt,
	type Tragwerk
} from '../statik';
import { kapsel, kapselAchse } from './anschluss/raumfachwerk';
import { FUGE_M, lueckenBestand, type Bestand } from './bestand';
import {
	DURCHBIEGUNG_TEILER,
	GARTEN_LICHT_M,
	ZUGANG_LAENGE_M,
	schneidet,
	tuerPrisma,
	type Anschluss,
	type Bauplan,
	type Belegung,
	type HausStatik,
	type Prisma,
	type StabStatik
} from './plan';

/**
 * Version of this generator (PD-11). Raise it whenever a rule changes a result: stored results
 * and cache keys carry it, so nothing stale is ever taken for current.
 * 2: own mirrored lattice, hangers to the capsule floor, seed parameters, check per occupancy.
 * 3: trapezoid girder: raking end posts instead of plumb posts, no overhang beyond the shoes.
 * 4: continuous upper chords survive removal in every seed class.
 */
export const HAENGEHAUS_VERSION = 4;
/** `block`: the full lattice. `kraefte`: every member sized for its force. `abtrag`: the form. */
export type Stufe = 'block' | 'kraefte' | 'abtrag';
export type Haengehaus = {
	traeger: TraegerPlan;
	anschluss: Anschluss;
	bestand: Bestand;
	statik?: HausStatik;
};
/**
 * What the seed decides, meters. Everything else follows from rules: the capsule fills the gap,
 * the lower chord clears the roof garden, the lattice divides the gap into equal fields.
 */
export type HausParameter = {
	/** Clear gap between the two old houses; the span of the carrier. */
	lueckeM: number;
	/** Number of lattice fields across the gap; each hangs one capsule rib. */
	felder: number;
	/** Height between lower and upper chord plane. */
	gurthoeheM: number;
	/** Depth of the two old houses. */
	tiefeM: number;
};

const LUECKEN_M = [10.4, 11.2, 12, 12.8, 13.6, 14.4, 15.2];
const GURTHOEHEN_M = [2.4, 2.8, 3.2];
const TIEFEN_M = [8, 9, 10];
/** A field is at least this long (ribs stay on the straight capsule wall) and at most that. */
const FELD_MIN_M = 3;
const FELD_MAX_M = 4.2;
/** Width of each old house along the span, meters. */
const ALTBAU_BREITE_M = 4.5;
/** Hanger nodes of the lower chord sit this far outside the capsule wall, meters. */
const HAENGER_ABSTAND_M = 0.2;
/** Air between the planting space of the roof garden and the lower chord, meters. */
const GURT_LUFT_M = 0.2;

/** Characteristic area loads, N/m² (122, appendix C). Floor build-up of the capsule. */
const KAPSEL_N_M2 = 1500;
/** Light shell of the capsule, per square meter of wall and roof (own assumption). */
const HUELLE_N_M2 = 800;
/** Imposed load by use of the room: dwelling, or workshop and light storage (own assumption). */
const NUTZLAST_N_M2: Partial<Record<FlowId, number>> = { people: 2000, material: 5000 };
const WOHNEN_N_M2 = 2000;
const NUTZLAST_MAX_N_M2 = 5000;
/** 0.30 m saturated substrate plus 0.10 m of standing water. */
const GARTEN_N_M2 = 5297 + 981;
const WIND_N_M2 = 800;
const ERDBESCHLEUNIGUNG_M_S2 = 9.81;
/** Partial factors of the single demo limit state. */
const GAMMA_G = 1.35;
const GAMMA_Q = 1.5;
/** Sway imperfection: this share of every vertical load also acts sideways. */
const SCHIEFSTELLUNG = 1 / 200;
/**
 * Every hanger is tightened to this tension when the capsule is hung in, newtons. A light, empty
 * capsule in a storm rolls against its wind holders and relieves one end hanger by a few hundred
 * newtons; the pretension keeps the rod taut instead of calling that a failure.
 */
const VORSPANNUNG_N = 5000;
/** Side of the capsule axis on which the two wind holders sit (the side of the fixed shoe). */
const HALTER_SEITE = -1;
/** Stiffness of a capsule side wall as the area of one steel diagonal per field, m². */
const WAND_FLAECHE_M2 = 1e-5;
/** Width of the walkway branch, meters (integration/hochwegnetz: hausAst). */
const STEG_BREITE_M = 1.6;
/**
 * Sections come in few steps (`KATALOG_RUHIG`): mirrored members are the same part anyway, and
 * a handful of weights reads as one kit. Measured cost against the fine catalog: see 123.
 */
const KATALOG = KATALOG_RUHIG;

/**
 * Parameters of the house for a seed (uint32). Pure; each parameter has its own hash channel, so
 * adding one later does not shift the others. `werte` overrides single parameters.
 */
export function hausParameter(saat: number, werte: Record<string, number> = {}): HausParameter {
	const wahl = <T>(liste: T[], kanal: string) =>
		liste[Math.floor(hashUnit(saat >>> 0, 'haengehaus', kanal) * liste.length)];
	const lueckeM = werte.lueckeM ?? wahl(LUECKEN_M, 'luecke');
	const teilungen: number[] = [];
	for (let n = 2; n <= 8; n++)
		if (lueckeM / n >= FELD_MIN_M && lueckeM / n <= FELD_MAX_M) teilungen.push(n);
	if (!teilungen.length) teilungen.push(Math.max(2, Math.round(lueckeM / 3.5)));
	return {
		lueckeM,
		felder: werte.felder ?? wahl(teilungen, 'felder'),
		gurthoeheM: werte.gurthoeheM ?? wahl(GURTHOEHEN_M, 'gurthoehe'),
		tiefeM: werte.tiefeM ?? wahl(TIEFEN_M, 'tiefe')
	};
}

/** Occupancy that decides the load: use of the hung room and whether its roof garden exists. */
export function belegungVon(haus: Bauplan): Belegung {
	const von = (art: 'raum' | 'garten') =>
		haus.einbauten.find((e) =>
			haus.anschluesse.some((a) => a.id === e.anschlussId && a.art === art)
		);
	return { raum: von('raum')?.nutzung ?? 'leer', garten: !!von('garten') };
}

/**
 * Builds the house for a seed. Deterministic. Throws `RangeError` if the lattice cannot carry
 * the capsule: a house without a load path is never returned. The members are sized for the
 * heaviest permitted occupancy (`statik.belegung === 'bemessung'`).
 */
export function haengehaus(
	werte: Record<string, number>,
	saat: number,
	stufe: Stufe = 'abtrag'
): Haengehaus {
	const m = modell(hausParameter(saat, werte));
	const tragwerk = abtragen(m.aufgabe('bemessung'), {
		stufe: stufe === 'abtrag' ? 'abtrag' : 'kraefte',
		katalog: KATALOG
	});
	if (tragwerk.status !== 'ok')
		throw new RangeError(
			`No stable space frame over the gap: ${tragwerk.status} (${tragwerk.elementId}).`
		);
	const statik = m.statik(tragwerk, 'bemessung');
	const kanten = m.staebe.filter((k) => statik.staebe[k.id]);
	const benutzt = new Set([
		...kanten.flatMap((k) => [k.a, k.b]),
		...statik.haenger.map((h) => h.knotenId)
	]);
	const lager = new Set(statik.lager.map((l) => l.knotenId));
	m.raum.knoten = [...new Set(statik.haenger.map((h) => h.knotenId))].sort();
	m.raum.fassungen = statik.haenger.map(({ knotenId, p }) => ({ knotenId, p }));
	return {
		traeger: {
			version: 1,
			familie: 'raumfachwerk',
			saat: saat >>> 0,
			werte: { ...m.parameter },
			knoten: m.knoten
				.filter((n) => benutzt.has(n.id))
				.map((n) => ({ ...n, rolle: lager.has(n.id) ? ('lager' as const) : n.rolle })),
			kanten,
			flaechen: [],
			zellen: [],
			belegung: {}
		},
		anschluss: m.raum,
		bestand: m.bestand,
		// The block shows the lattice that can stand, before any member has a size.
		statik: stufe === 'block' ? undefined : statik
	};
}

/**
 * Checks the built carrier under the current occupancy: same members, same sections, new load.
 * Returns the house with a fresh `statik`; carrier and infills keep their reference identity.
 * A house without simulation is returned as it is. Throws `RangeError` if the built carrier
 * does not stand under this occupancy.
 */
export function nachrechnen(haus: Bauplan): Bauplan {
	const alt = haus.statik;
	if (!alt || haus.familie !== 'raumfachwerk') return haus;
	const belegung = belegungVon(haus);
	const m = modell(haus.traeger.werte as HausParameter);
	const querschnitte: Record<string, Querschnitt> = {};
	const alsQuerschnitt = (s: StabStatik) => (s.druck ? rohr : rundstab)(s.durchmesserM);
	for (const [id, s] of Object.entries(alt.staebe)) querschnitte[id] = alsQuerschnitt(s);
	for (const h of alt.haenger) querschnitte[h.id] = alsQuerschnitt(h);
	const tragwerk = abtragen(m.aufgabe(belegung), { stufe: 'nachweis', querschnitte });
	if (tragwerk.status !== 'ok')
		throw new RangeError(
			`The built structure does not stand under this occupancy: ${tragwerk.status} (${tragwerk.elementId}).`
		);
	const statik = m.statik(tragwerk, belegung);
	// Without the capsule its links hang free: they stay part of the house and carry nothing.
	if (belegung.raum === 'leer')
		statik.haenger = alt.haenger.map((h) => ({
			...h,
			zugN: 0,
			druckN: 0,
			ausnutzung: 0,
			uM: [0, 0, 0]
		}));
	// The built carrier is the same whatever hangs in it: its counts and its steel do not change.
	statik.kennzahlen.kandidaten = alt.kennzahlen.kandidaten;
	statik.kennzahlen.staebe = alt.kennzahlen.staebe;
	statik.kennzahlen.masseKg = alt.kennzahlen.masseKg;
	return { ...haus, statik };
}

/**
 * Weight of the steel itself in newtons, characteristic. The shoes carry it on top of the hanging
 * load (`statik.lastN`), also when the capsule has been taken out.
 */
export function eigengewichtN(statik: HausStatik): number {
	return statik.kennzahlen.masseKg * ERDBESCHLEUNIGUNG_M_S2;
}

const SPIEGEL: [number, number][] = [
	[1, 1],
	[-1, 1],
	[1, -1],
	[-1, -1]
];

/** Walkway reserve used by this generator; owner-local, meters. */
export function stegPrisma(tuer: Anschluss['tuer']): Prisma {
	const [tx, ty] = tuer.tangente,
		[px, py] = tuer.p;
	return {
		z: FUGE_M,
		hoeheM: tuerPrisma(tuer).hoeheM,
		// The tangent/outward map reflects orientation: local CW becomes world CCW.
		polygon: [
			[-STEG_BREITE_M / 2, 0],
			[-STEG_BREITE_M / 2, ZUGANG_LAENGE_M],
			[STEG_BREITE_M / 2, ZUGANG_LAENGE_M],
			[STEG_BREITE_M / 2, 0]
		].map(([u, v]) => [px + tx * u + ty * v, py + ty * u - tx * v] as [number, number])
	};
}

/** Geometry, candidates and loads of one house; everything the two entry points share. */
function modell(parameter: HausParameter) {
	const { lueckeM, felder, gurthoeheM, tiefeM } = parameter;
	if (!(lueckeM > 0) || !Number.isInteger(felder) || felder < 2 || !(gurthoeheM > 0))
		throw new RangeError('Invalid house parameters.');
	const feldM = lueckeM / felder;
	// 1 Stock: two old houses beside the gap, centered on the origin. Their party walls carry.
	const bestand = lueckenBestand(
		-lueckeM / 2 - ALTBAU_BREITE_M,
		-tiefeM / 2,
		lueckeM + 2 * ALTBAU_BREITE_M,
		tiefeM,
		ALTBAU_BREITE_M
	);

	// 2 Capsule on the span axis and the spaces that stay clear: room, planting space, door, walkway.
	const raum = kapsel(bestand, [-1, 1], '');
	const achse = kapselAchse(raum);
	const halbeBreiteM = achse.halbeBreiteM;
	const dach = raum.z + raum.hoeheM;
	const reiheM = halbeBreiteM + HAENGER_ABSTAND_M;
	const untergurtZ = dach + GARTEN_LICHT_M + GURT_LUFT_M;
	const obergurtZ = untergurtZ + gurthoeheM;
	const steg = stegPrisma(raum.tuer);
	const frei: Prisma[] = [
		raum,
		{ ...raum, z: dach, hoeheM: GARTEN_LICHT_M },
		tuerPrisma(raum.tuer),
		steg
	];
	// The door is on one side only. A member is a part with mirror images: it is only a
	// candidate if none of its images crosses a clear space.
	const durchFreiraum = (a: Vec3, b: Vec3) =>
		SPIEGEL.some(([sx, sy]) =>
			frei.some((r) => schneidet([sx * a[0], sy * a[1], a[2]], [sx * b[0], sy * b[1], b[2]], r))
		);

	// 3 Lattice as a trapezoid girder: the lower chord plane has one node above every rib, the
	// upper chord plane sits half a field offset and starts one field inside the shoes. Each lower
	// node is tied to the upper nodes around it. Shoes on the party walls beside the door reach
	// the lattice with raking end posts only: no member at a shoe is plumb, nothing overhangs.
	const knoten: Knoten[] = [];
	const ort = new Map<string, Vec3>();
	const setze = (id: string, p: Vec3, rolle: Knoten['rolle'] = 'nabe') => {
		knoten.push({ id, p, rolle });
		ort.set(id, p);
		return id;
	};
	const oben = (i: number, j: number) => `raumfachwerk:k:o:${i}:${j}`;
	const unten = (i: number, s: number) => `raumfachwerk:k:m:${i}:${s}`;
	const schuh = (seite: number, s: number) => `raumfachwerk:k:u:${seite}:${s}`;
	const erster = 1,
		letzter = felder - 1;
	for (let i = erster; i <= letzter; i++)
		for (const j of [-1, 0, 1])
			setze(oben(i, j), [(i - felder / 2) * feldM, j * 2 * reiheM, obergurtZ]);
	for (let i = 0; i < felder; i++)
		for (const s of [-1, 1])
			setze(unten(i, s), [(i + 0.5 - felder / 2) * feldM, s * reiheM, untergurtZ]);
	for (const seite of [-1, 1])
		for (const s of [-1, 1])
			setze(schuh(seite, s), [(seite * lueckeM) / 2, s * 2 * reiheM, FUGE_M], 'lager');
	const staebe: Kante[] = [];
	const stab = (a: string, b: string) => {
		const pa = ort.get(a),
			pb = ort.get(b);
		if (!pa || !pb || durchFreiraum(pa, pb)) return;
		staebe.push({ id: kantenId(a, b), a, b, rolle: 'stab', klasse: 'A' });
	};
	for (let i = erster; i <= letzter; i++) {
		for (const j of [-1, 0, 1]) stab(oben(i, j), oben(i + 1, j));
		stab(oben(i, -1), oben(i, 0));
		stab(oben(i, 0), oben(i, 1));
		// Chord squares are no triangles: a cross in each keeps the upper plane from shearing.
		for (const j of [-1, 0]) {
			stab(oben(i, j), oben(i + 1, j + 1));
			stab(oben(i, j + 1), oben(i + 1, j));
		}
	}
	for (let i = 0; i < felder; i++) {
		for (const s of [-1, 1]) {
			stab(unten(i, s), unten(i + 1, s));
			for (const j of [0, s]) for (const k of [i, i + 1]) stab(unten(i, s), oben(k, j));
		}
		stab(unten(i, -1), unten(i, 1));
	}
	for (const seite of [-1, 1])
		for (const s of [-1, 1]) {
			const ende = seite < 0 ? erster : letzter;
			const feld = seite < 0 ? 0 : felder - 1;
			// End post: from the shoe up to the first upper chord node of its own row; it pushes.
			stab(schuh(seite, s), oben(ende, s));
			// A shoe slides, so it takes no thrust: a flat tie to the second lower chord node pulls
			// against the raking post. A leg to the first lower chord node holds the shoe sideways.
			// (A tie to the first node runs almost parallel to the post: measured 1.4 MN.)
			stab(schuh(seite, s), unten(feld - seite, s));
			stab(schuh(seite, s), unten(feld, s));
		}

	// 4 The capsule: one rigid rib frame below every lower chord node over the gap. Stringers
	// and the floor and roof plates hold the ribs together. The light side walls only brace: the
	// shell is no beam, a rib cannot lean on its neighbor, so every rib has to hang by itself.
	const rippen = Array.from({ length: felder }, (_, i) => (i + 0.5 - felder / 2) * feldM);
	const ecke = (i: number, seite: number, hoch: boolean) =>
		`kapsel:${hoch ? 'o' : 'u'}:${i}:${seite > 0 ? 'p' : 'm'}`;
	const kasten: Knoten[] = [];
	rippen.forEach((x, i) => {
		for (const seite of [-1, 1])
			for (const hoch of [true, false])
				kasten.push({
					id: ecke(i, seite, hoch),
					p: [x, seite * halbeBreiteM, hoch ? dach : raum.z],
					rolle: 'frei'
				});
	});
	for (const n of kasten) ort.set(n.id, n.p);
	const kapselStaebe: Kandidat[] = [];
	const starr = (a: string, b: string, flaecheM2?: number) =>
		kapselStaebe.push({
			id: `starr:${a}|${b}`,
			a,
			b,
			rolle: 'starr',
			...(flaecheM2 ? { flaecheM2 } : {})
		});
	rippen.forEach((_, i) => {
		for (const hoch of [true, false]) starr(ecke(i, -1, hoch), ecke(i, 1, hoch));
		for (const seite of [-1, 1]) starr(ecke(i, seite, true), ecke(i, seite, false));
		starr(ecke(i, -1, true), ecke(i, 1, false));
		if (i === 0) return;
		for (const hoch of [true, false]) {
			for (const seite of [-1, 1]) starr(ecke(i - 1, seite, hoch), ecke(i, seite, hoch));
			starr(ecke(i - 1, -1, hoch), ecke(i, 1, hoch));
		}
		for (const seite of [-1, 1])
			starr(ecke(i - 1, seite, true), ecke(i, seite, false), WAND_FLAECHE_M2);
	});
	// Parapet of the roof garden at the two end ribs: it reaches up to the lower chord plane.
	const bruestung = (i: number, seite: number) => `kapsel:b:${i}:${seite > 0 ? 'p' : 'm'}`;
	for (const i of [0, felder - 1])
		for (const seite of [-1, 1]) {
			const id = bruestung(i, seite);
			const p: Vec3 = [rippen[i], seite * halbeBreiteM, untergurtZ];
			kasten.push({ id, p, rolle: 'frei' });
			ort.set(id, p);
			starr(id, ecke(i, seite, true));
			starr(id, ecke(i, -seite, true));
			starr(id, ecke(i === 0 ? 1 : i - 1, seite, true));
		}
	// Hangers: one rod per rib end, outside the shell from the floor rib straight up to the lower
	// chord. They only pull and carry all the weight. Two more hold the capsule in place without
	// making it part of the carrier:
	// - along the span, sloping hangers at midspan (a V or a cross). Held in the middle only,
	//   the capsule is no tie between the shoes.
	// - across, a short level tube from the parapet to the chord node beside it, at each end and
	//   on one side only. It carries no weight and may push: wind comes from either side. A
	//   holder on both sides would make the capsule a tie between the two chord rows.
	const haengerEnde = new Map<string, { knotenId: string; p: Vec3 }>();
	const haenger = (praefix: string, nabe: string, eckeId: string, rolle: Kandidat['rolle']) => {
		const a = ort.get(nabe),
			b = ort.get(eckeId);
		if (!a || !b || durchFreiraum(a, b)) return;
		const id = `${praefix}:${nabe}|${eckeId}`;
		kapselStaebe.push({
			id,
			a: nabe,
			b: eckeId,
			rolle,
			...(rolle === 'haenger' ? { vorspannungN: VORSPANNUNG_N } : {})
		});
		haengerEnde.set(id, { knotenId: nabe, p: b });
	};
	const mitte = (felder - 1) / 2;
	rippen.forEach((_, i) => {
		for (const s of [-1, 1]) {
			haenger('haenger', unten(i, s), ecke(i, s, false), 'haenger');
			if (Math.abs(i - mitte) < 1)
				for (const k of [i - 1, i + 1])
					if (Math.abs(k - mitte) <= 1)
						haenger('haenger', unten(k, s), ecke(i, s, false), 'haenger');
			if (s === HALTER_SEITE && (i === 0 || i === felder - 1))
				haenger('halter', unten(i, s), bruestung(i, s), 'tragstab');
		}
	});

	// Mirror images about midspan and about the capsule axis are one part.
	const gruppe = (k: { a: string; b: string }) => {
		const a = ort.get(k.a) as Vec3,
			b = ort.get(k.b) as Vec3;
		const text = (p: Vec3, sx: number, sy: number) =>
			[sx * p[0], sy * p[1], p[2]].map((v) => Math.round(v * 1e4) + 0).join(',');
		return SPIEGEL.map(([sx, sy]) => [text(a, sx, sy), text(b, sx, sy)].sort().join('|')).sort()[0];
	};
	const gitterKandidaten: Kandidat[] = staebe.map((k) => ({
		id: k.id,
		a: k.a,
		b: k.b,
		rolle: 'tragstab',
		gruppe: gruppe(k),
		// Longitudinal upper chords define the continuous trapezoid silhouette in every seed.
		bleibt:
			ort.get(k.a)?.[2] === obergurtZ &&
			ort.get(k.b)?.[2] === obergurtZ &&
			ort.get(k.a)?.[1] === ort.get(k.b)?.[1]
	}));
	const kapselKandidaten: Kandidat[] = kapselStaebe.map((k) =>
		k.rolle === 'starr' ? k : { ...k, gruppe: gruppe(k) }
	);

	// 5 Loads by tributary length of each rib; the round ends belong to the end ribs.
	const anteil = rippen.map((x, i) => {
		const links = i ? (x - rippen[i - 1]) / 2 : x + achse.halbeGeradeM + halbeBreiteM;
		const rechts =
			i < rippen.length - 1 ? (rippen[i + 1] - x) / 2 : achse.halbeGeradeM - x + halbeBreiteM;
		return { links, rechts };
	});
	const laenge = anteil.reduce((s, a) => s + a.links + a.rechts, 0);
	const seitenflaecheM2 = laenge * raum.hoeheM,
		stirnflaecheM2 = 2 * halbeBreiteM * raum.hoeheM;
	/** Area load on floor or roof; `seite` restricts it to the left (−1) or right (1) half. */
	const flaechenlast = (nM2: number, hoch: boolean, seite = 0) =>
		anteil.flatMap((a, i) => {
			const mittig = Math.abs(rippen[i]) < 1e-9;
			const wirksam =
				seite === 0
					? a.links + a.rechts
					: mittig
						? (a.links + a.rechts) / 2
						: Math.sign(rippen[i]) === seite
							? a.links + a.rechts
							: 0;
			const kraft = (-nM2 * raum.flaecheM2 * wirksam) / laenge / 2;
			return [-1, 1].map((s) => ({ knotenId: ecke(i, s, hoch), kraftN: [0, 0, kraft] as Vec3 }));
		});
	const quer = (richtung: 1 | -1) =>
		anteil.flatMap((a, i) =>
			[-1, 1].flatMap((s) =>
				[true, false].map((hoch) => ({
					knotenId: ecke(i, s, hoch),
					kraftN: [
						0,
						(richtung * WIND_N_M2 * seitenflaecheM2 * (a.links + a.rechts)) / laenge / 4,
						0
					] as Vec3
				}))
			)
		);
	const laengs = (richtung: 1 | -1) =>
		[-1, 1].flatMap((s) =>
			[true, false].map((hoch) => ({
				knotenId: ecke(richtung > 0 ? 0 : rippen.length - 1, s, hoch),
				kraftN: [(richtung * WIND_N_M2 * stirnflaecheM2) / 4, 0, 0] as Vec3
			}))
		);
	const mal = (faktor: number, lasten: Lastfall['lasten']) =>
		lasten.map((l) => ({ ...l, kraftN: l.kraftN.map((v) => v * faktor) as Vec3 }));
	const schief = (lasten: Lastfall['lasten'], achseIndex: 0 | 1, richtung: number) =>
		lasten.map((l) => {
			const kraftN: Vec3 = [0, 0, 0];
			kraftN[achseIndex] = -l.kraftN[2] * SCHIEFSTELLUNG * richtung;
			return { ...l, kraftN };
		});
	const g = (x: number, y: number, faktor: number): Vec3 => [
		x * faktor * SCHIEFSTELLUNG,
		y * faktor * SCHIEFSTELLUNG,
		-faktor
	];
	// Shell: walls along the perimeter and the roof, spread like an area load on the roof corners.
	const umfangM = 2 * laenge + (Math.PI - 2) * 2 * halbeBreiteM;
	const huelleN = HUELLE_N_M2 * (umfangM * raum.hoeheM + raum.flaecheM2);

	/** Load cases of one occupancy; `voll` is the design load hanging in the gap. */
	function lasten(belegung: Belegung | 'bemessung') {
		const beladen = belegung === 'bemessung' || belegung.raum !== 'leer';
		const garten = belegung === 'bemessung' || belegung.garten ? GARTEN_N_M2 : 0;
		const nutzlast =
			belegung === 'bemessung'
				? NUTZLAST_MAX_N_M2
				: belegung.raum === 'leer'
					? 0
					: (NUTZLAST_N_M2[belegung.raum] ?? WOHNEN_N_M2);
		const leer = beladen
			? [...flaechenlast(KAPSEL_N_M2, false), ...flaechenlast(huelleN / raum.flaecheM2, true)]
			: [];
		const wind = beladen ? 1 : 0;
		const staendig = beladen ? [...leer, ...flaechenlast(garten, true)] : [];
		const nutzung = beladen ? flaechenlast(nutzlast, false) : [];
		const voll = [...mal(GAMMA_G, staendig), ...mal(GAMMA_Q, nutzung)];
		const einseitig = (seite: number) =>
			beladen
				? [
						...mal(GAMMA_G, leer),
						...mal(GAMMA_G, flaechenlast(garten, true, seite)),
						...mal(GAMMA_Q, flaechenlast(nutzlast, false, seite))
					]
				: [];
		const lastfaelle: Lastfall[] = [
			{ id: 'voll', eigengewichtG: g(0, 0, GAMMA_G), lasten: voll },
			{ id: 'einseitig-links', eigengewichtG: g(0, 0, GAMMA_G), lasten: einseitig(-1) },
			{ id: 'einseitig-rechts', eigengewichtG: g(0, 0, GAMMA_G), lasten: einseitig(1) },
			...([1, -1] as const).flatMap((r): Lastfall[] => [
				{
					id: `wind-quer${r > 0 ? '+' : '-'}`,
					eigengewichtG: g(0, r, GAMMA_G),
					lasten: [...voll, ...schief(voll, 1, r), ...mal(wind * GAMMA_Q, quer(r))]
				},
				{
					id: `wind-laengs${r > 0 ? '+' : '-'}`,
					eigengewichtG: g(r, 0, GAMMA_G),
					lasten: [...voll, ...schief(voll, 0, r), ...mal(wind * GAMMA_Q, laengs(r))]
				},
				// Light capsule in a storm: the case that could slacken a hanger or lift a bearing.
				{
					id: `leicht-quer${r > 0 ? '+' : '-'}`,
					eigengewichtG: g(0, 0, 1),
					lasten: [...leer, ...mal(wind * GAMMA_Q, quer(r))]
				}
			]),
			{ id: 'gebrauch', eigengewichtG: g(0, 0, 1), lasten: [...staendig, ...nutzung] }
		];
		return { lastfaelle, lastN: 0 - voll.reduce((s, l) => s + l.kraftN[2], 0) };
	}

	// Shoes only carry downwards, so the old walls get no thrust. One fixed point on the left and
	// one guide on the right hold the carrier against wind; the carrier ties itself together.
	const festpunkt = schuh(-1, -1),
		fuehrung = schuh(1, -1);
	const lager = [-1, 1].flatMap((seite) =>
		[-1, 1].map((s) => {
			const knotenId = schuh(seite, s);
			return {
				knotenId,
				fest: [knotenId === festpunkt, knotenId === festpunkt || knotenId === fuehrung, true] as [
					boolean,
					boolean,
					boolean
				],
				// A shoe on an old wall crown presses; it is not anchored against uplift.
				nurDruck: true
			};
		})
	);

	function aufgabe(belegung: Belegung | 'bemessung'): Aufgabe {
		const beladen = belegung === 'bemessung' || belegung.raum !== 'leer';
		const ohneKapsel = (): Lastfall[] =>
			lasten({ raum: 'leer', garten: false }).lastfaelle.filter((l) => l.id !== 'gebrauch');
		return {
			knoten: [...knoten, ...(beladen ? kasten : [])].map((n) => ({ id: n.id, p: n.p })),
			kandidaten: [...gitterKandidaten, ...(beladen ? kapselKandidaten : [])],
			lager,
			lastfaelle: lasten(belegung).lastfaelle,
			werkstoff: STAHL,
			gebrauch: { lastfallId: 'gebrauch', grenzeM: lueckeM / DURCHBIEGUNG_TEILER },
			// The carrier stands before the capsule is hung in and after it has been taken out.
			...(belegung === 'bemessung'
				? { zustaende: [{ ohneKnoten: kasten.map((n) => n.id), lastfaelle: ohneKapsel() }] }
				: {})
		};
	}

	const gitterIds = new Set(knoten.map((n) => n.id));
	const bodenrippen = rippen.map((_, i): [Vec3, Vec3] => [
		ort.get(ecke(i, -1, false)) as Vec3,
		ort.get(ecke(i, 1, false)) as Vec3
	]);
	function statik(
		tragwerk: Extract<Tragwerk, { status: 'ok' }>,
		belegung: Belegung | 'bemessung'
	): HausStatik {
		const ergebnis: HausStatik = {
			belegung,
			staebe: {},
			haenger: [],
			rippen: bodenrippen,
			verformungM: {},
			lager: lager
				.map(({ knotenId, fest }) => {
					const kraefte = Object.values(tragwerk.reaktionenN).map((r) => r[knotenId] ?? [0, 0, 0]);
					return {
						knotenId,
						art: fest[0]
							? ('fest' as const)
							: fest[1]
								? ('gefuehrt' as const)
								: ('gleitend' as const),
						druckN: Math.max(0, ...kraefte.map((r) => r[2])),
						schubN: Math.max(0, ...kraefte.map((r) => Math.hypot(r[0], r[1])))
					};
				})
				// A shoe that carries nothing in any load case is no bearing of this house.
				.filter((l) => l.druckN > 0 || l.schubN > 0),
			lastN: lasten(belegung).lastN,
			spannweiteM: lueckeM,
			kennzahlen: tragwerk.kennzahlen
		};
		for (const s of tragwerk.staebe) {
			const werte: StabStatik = {
				durchmesserM: s.querschnitt.durchmesserM,
				druck: s.querschnitt.art === 'rohr',
				zugN: s.zugN,
				druckN: s.druckN,
				ausnutzung: s.ausnutzung,
				...(s.schlaff ? { schlaff: true as const } : {})
			};
			const ende = haengerEnde.get(s.id);
			if (ende)
				ergebnis.haenger.push({
					...werte,
					id: s.id,
					...ende,
					uM: tragwerk.verschiebungenM[s.b] ?? [0, 0, 0]
				});
			else ergebnis.staebe[s.id] = werte;
		}
		for (const [id, u] of Object.entries(tragwerk.verschiebungenM))
			if (gitterIds.has(id)) ergebnis.verformungM[id] = u;
		return ergebnis;
	}

	// The room is named after the lower chord node nearest to midspan; ties by ID.
	raum.elementId = knoten
		.filter((n) => n.p[2] === untergurtZ)
		.sort((a, b) => Math.abs(a.p[0]) - Math.abs(b.p[0]) || a.id.localeCompare(b.id))[0].id;
	raum.id = `${raum.elementId}/anschluss`;
	return { parameter, bestand, raum, knoten, staebe, aufgabe, statik };
}
