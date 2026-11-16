/**
 * City · elevated walkways integration: the five structures are nodes and carriers of the path network.
 * Everything new starts at the elevated walkway level (8 m): folded plate and dome on old building roofs, the
 * honeycomb with a slab at 8 m, the gridshell on the eaves of a courtyard, the space frame
 * with its lower chord. Footbridges follow the page's rule (spanning tree, then loops, at most
 * `SPANNWEITE`); only the space frame carries the path farther than a footbridge reaches.
 * Dimensions in meters, x/y ground plane, z up. Headless, deterministic per seed.
 */
import { familie, loopZiel, planen, kantenId, type TraegerPlan, type Vec3 } from '../index';
import type { TraegerFamilieText } from '../../../data/traeger';
import { box, type Primitive } from '../../parametrik/types';
import { bestandDetails } from '../../parametrik/formen/eckbestand';
import { wegenetz, type Knoten } from '../../bibel/wege';

/** Height of the elevated walkway level: two old-building floors. */
export const HOCHWEG_M = 8;
/** Width of a footbridge. */
export const STEG_BREITE_M = 2.2;

export type NetzKante = {
	a: number;
	b: number;
	laenge: number;
	target: string;
	schleife: boolean;
	/** The path lies inside a structure, not on a footbridge of its own. */
	traeger: boolean;
	/** Visible length share, 0–1. */
	anteil: number;
};
export type QuartierPlan = {
	plan: TraegerPlan;
	familie: TraegerFamilieText | 'wege';
	lage: { versatz: Vec3; drehungRad: number };
	fokus: boolean;
};
export type Quartier = {
	saat: number;
	plaene: QuartierPlan[];
	bestand: Primitive[];
	knoten: Knoten[];
	/** Order of growth: carriers, spanning tree, loops. `anteil` is 1 here. */
	kanten: NetzKante[];
	figuren: Vec3[];
};

/** Building plots: center in plan, foot height and the values that differ from the family's final image. */
const PLAETZE: Record<
	TraegerFamilieText,
	{ mitte: [number, number]; fussM: number; werte: Record<string, number> }
> = {
	faltwerk: { mitte: [5, 8.5], fussM: HOCHWEG_M, werte: { bahnen: 4 } },
	raumfachwerk: { mitte: [20, 8], fussM: 0, werte: { felder: 4, tiefe: 2, lagen: 1 } },
	// Plinth 1 m: the third slab of the honeycomb thus lies exactly on the elevated walkway level.
	wabe: { mitte: [39, 8], fussM: 1, werte: { ringe: 1, lagen: 5, stufen: 1 } },
	kuppel: { mitte: [14, 37], fussM: HOCHWEG_M, werte: { radius: 9 } },
	gitterschale: { mitte: [36, 37], fussM: HOCHWEG_M, werte: { grundriss: 0 } }
};
const FAMILIEN = Object.keys(PLAETZE) as TraegerFamilieText[];

/** Old buildings: [id, x, y, width, depth, floors, gable roof]. Flat roofs carry new additions or paths. */
const HAEUSER: [string, number, number, number, number, number, boolean][] = [
	['falt', 0, 1, 10, 15, 2, false],
	['gasse', 15, 5, 10, 6, 1, false],
	['halle', 4, 27, 20, 20, 2, false],
	['hof-sued', 24, 20, 24, 5, 2, false],
	['hof-nord', 24, 49, 24, 5, 2, false],
	['hof-ost', 48, 20, 5, 34, 2, false],
	['zeile-west', -8, 27, 9, 20, 3, true],
	['zeile-ost', 49, -1, 6, 18, 3, true]
];

/** Nodes of the network on the elevated walkway level (level 2 = 8 m, as in data/stadtHochwege.ts). */
const KNOTEN: Knoten[] = (
	[
		['faltwerk', 5, 8.5],
		['faltwerk-ost', 10.7, 8],
		['wabe-west', 29.4, 8],
		['wabe-schacht', 39, 8],
		['wabe-nord', 39, 17],
		['hof-sued', 36, 24.5],
		['hof-mitte', 36, 37],
		['hof-west', 23.5, 37],
		['hof-nord', 36, 49.5],
		['hof-ost', 48.5, 37],
		['kuppel', 14, 37],
		['faltwerk-nord', 5, 16],
		['halle-sued', 7, 27.5]
	] as [string, number, number][]
).map(([id, x, y]) => ({ id, x, y, ebene: 2 }));
/** The space frame carries the path across the alley: farther than a footbridge spans. */
const TRAEGER_WEG = ['faltwerk-ost', 'wabe-west'] as const;

function haus([id, x, y, w, d, geschosse, dach]: (typeof HAEUSER)[number]): Primitive[] {
	const outline: [number, number][] = [
		[x, y],
		[x + w, y],
		[x + w, y + d],
		[x, y + d]
	];
	const aus: [number, number][] = [
		[0, -1],
		[1, 0],
		[0, 1],
		[-1, 0]
	];
	return [
		box(`bestand:${id}`, [x, y, 0], [w, d, geschosse * 4], '--paper', 'bestand'),
		...bestandDetails({
			id,
			cells: [],
			outline,
			center: [x + w / 2, y + d / 2],
			levels: geschosse,
			first: 0,
			dach: dach ? 'sattel' : null,
			fassaden: outline.map((a, i) => ({
				a,
				b: outline[(i + 1) % 4],
				out: aus[i],
				levels: Array.from({ length: geschosse }, (_, j) => j)
			}))
		})
	];
}

/** Network in growth order: first the path inside the carrier, then spanning tree, then loops. */
function netz(schleifen: number): NetzKante[] {
	const index = (id: string) => KNOTEN.findIndex((k) => k.id === id);
	const [ta, tb] = TRAEGER_WEG.map(index);
	const n = wegenetz(KNOTEN, schleifen);
	const steg = (e: { a: number; b: number; laenge: number }, schleife: boolean): NetzKante => ({
		...e,
		target: `kante:${KNOTEN[e.a].id}-${KNOTEN[e.b].id}`,
		schleife,
		traeger: false,
		anteil: 1
	});
	return [
		{
			a: ta,
			b: tb,
			laenge: Math.hypot(KNOTEN[ta].x - KNOTEN[tb].x, KNOTEN[ta].y - KNOTEN[tb].y),
			target: `kante:${KNOTEN[ta].id}-${KNOTEN[tb].id}`,
			schleife: false,
			traeger: true,
			anteil: 1
		},
		...n.baum.map((e) => steg(e, false)),
		...n.schleifen.map((e) => steg(e, true))
	];
}

/** Edges with their share for the step: step i grows edge i from a to b. */
export function netzBei(kanten: readonly NetzKante[], schritt: number): NetzKante[] {
	if (!Number.isFinite(schritt)) throw new RangeError('Invalid step');
	return kanten.map((e, i) => ({ ...e, anteil: Math.max(0, Math.min(1, schritt - i)) }));
}

/**
 * The path network as a carrier plan: one deck slab per edge (face `boden`, occupied by people)
 * between four own nodes. Growth only moves nodes; IDs, edges and faces stay
 * the same (PT-11). The plan is geometrically valid as soon as every edge is visible; an edge
 * that has not grown yet collapses onto its start point.
 */
export function wegePlan(
	knoten: readonly Knoten[],
	kanten: readonly NetzKante[],
	saat: number
): TraegerPlan {
	const plan: TraegerPlan = {
		version: 1,
		familie: 'orthogonal',
		saat: saat >>> 0,
		werte: { breite: STEG_BREITE_M, hoehe: HOCHWEG_M },
		knoten: [],
		kanten: [],
		flaechen: [],
		zellen: [],
		belegung: {}
	};
	for (const e of kanten) {
		const a = knoten[e.a],
			b = knoten[e.b];
		const dx = (b.x - a.x) / e.laenge,
			dy = (b.y - a.y) / e.laenge;
		const ende = [a.x + (b.x - a.x) * e.anteil, a.y + (b.y - a.y) * e.anteil];
		// Visible edges keep their width; invisible ones collapse onto a point.
		const halb = e.anteil > 0 ? STEG_BREITE_M / 2 : 0;
		const ecke = (name: string, x: number, y: number, seite: number) => {
			const id = `weg:${e.target}:${name}`;
			plan.knoten.push({
				id,
				p: [x - dy * halb * seite, y + dx * halb * seite, a.ebene * 4],
				rolle: 'frei'
			});
			return id;
		};
		const ring = [
			ecke('a0', a.x, a.y, -1),
			ecke('b0', ende[0], ende[1], -1),
			ecke('b1', ende[0], ende[1], 1),
			ecke('a1', a.x, a.y, 1)
		];
		ring.forEach((id, i) => {
			const next = ring[(i + 1) % 4];
			plan.kanten.push({ id: kantenId(id, next), a: id, b: next, rolle: 'rand' });
		});
		const flaeche = `weg:${e.target}:deck`;
		plan.flaechen.push({ id: flaeche, knoten: ring, rolle: 'boden' });
		plan.belegung[flaeche] = 'people';
	}
	return plan;
}

/** The fixed district of a seed: five structures at the existing stock and the full network. */
export function tragwerkQuartier(saat = 42, schleifen = 2): Quartier {
	const s = saat >>> 0;
	const plaene: QuartierPlan[] = FAMILIEN.map((id) => {
		const f = familie(id),
			ort = PLAETZE[id];
		const original = planen(id, { ...loopZiel(f, f.loop.length - 1), ...ort.werte }, s);
		// Paths carry the color of people. Food and energy remain beside them; no image shows
		// more than three flows (MAX_FOKUS_STROEME).
		const belegung = Object.fromEntries(
			Object.entries(original.belegung).map(([ziel, strom]) => [
				ziel,
				strom === 'material' || strom === 'water' ? 'leer' : strom
			])
		);
		return {
			familie: id,
			plan: { ...original, belegung },
			lage: { versatz: [ort.mitte[0], ort.mitte[1], ort.fussM], drehungRad: 0 },
			fokus: true
		};
	});
	const kanten = netz(schleifen);
	const bestand = HAEUSER.flatMap(haus);
	const wabe = PLAETZE.wabe;
	// Plinth of the honeycomb: remnant of an old building, 1 m high.
	bestand.push(
		box(
			'bestand:wabe-sockel',
			[wabe.mitte[0] - 9.5, wabe.mitte[1] - 9.5, 0],
			[19, 19, wabe.fussM],
			'--paper',
			'bestand'
		)
	);
	const auf = (id: string, dx = 0, dy = 0): Vec3 => {
		const k = KNOTEN.find((n) => n.id === id) ?? KNOTEN[0];
		return [k.x + dx, k.y + dy, HOCHWEG_M];
	};
	return {
		saat: s,
		plaene,
		bestand,
		knoten: KNOTEN.map((k) => ({ ...k })),
		kanten,
		figuren: [auf('faltwerk-ost', 3), auf('wabe-nord', 0, 3), auf('hof-west', -3), [-2, 12, 0]]
	};
}

/** Stage state for the step: the five fixed plans and the network in its growth. */
export function quartierBei(q: Quartier, schritt: number) {
	const kanten = netzBei(q.kanten, schritt);
	const wege: QuartierPlan = {
		familie: 'wege',
		plan: wegePlan(q.knoten, kanten, q.saat),
		lage: { versatz: [0, 0, 0], drehungRad: 0 },
		fokus: true
	};
	return { plaene: [...q.plaene, wege], kanten };
}

/** A house branch ends exactly at its sole eight meter port; local meters, no new path engine. */
export function hausAst(port: Vec3, tangente: [number, number] = [1, 0], laengeM = 4): Primitive[] {
	const [x, y, z] = port,
		[tx, ty] = tangente;
	const at = (u: number, v: number, h: number): Vec3 => [
		x + tx * u + ty * v,
		y + ty * u - tx * v,
		h
	];
	return [
		{
			id: 'hochweg:haus-port',
			kind: 'prism',
			polygon: [at(-0.8, 0, z), at(0.8, 0, z), at(0.8, laengeM, z), at(-0.8, laengeM, z)].map(
				([x, y]) => [x, y]
			),
			z: z - 0.25,
			height: 0.25,
			token: '--paper',
			role: 'neu',
			material: 'concrete'
		},
		...[-0.8, 0.8].map((u): Primitive => ({
			id: `hochweg:haus-port:${u}`,
			kind: 'polyline',
			points: [at(u, 0, z + 1), at(u, laengeM, z + 1)],
			token: '--paper',
			role: 'neu',
			material: 'metal'
		}))
	];
}

/** Explicit circulation graph: shared honeycomb walls and its reserved vertical shaft.
 * No free-space search. Entries on the eight meter landing connect directly to its port.
 */
export function hausZugang(haus: {
	familie: string;
	traeger: TraegerPlan;
	eingang: { id: string; p: Vec3 };
	anschluesse: {
		id: string;
		elementId: string;
		art: string;
		z: number;
		wandIds: string[];
		tuer: { p: Vec3 };
	}[];
}) {
	const rooms = haus.anschluesse.filter((a) => a.art === 'raum');
	const kanten: [string, string][] = [];
	const punkte: Record<string, Vec3> = { [haus.eingang.id]: haus.eingang.p };
	for (const a of rooms) {
		punkte[a.id] = a.tuer.p;
		if (haus.familie !== 'wabe') {
			if (Math.abs(a.z - HOCHWEG_M) < 1e-9) kanten.push([haus.eingang.id, a.id]);
			continue;
		}
		const shaft = `schacht:${a.z}`;
		punkte[shaft] = [0, 0, a.z];
		// Ring one borders the reserved central shaft. Wall incidence joins subsequent rings.
		const cell = haus.traeger.zellen.find((z) => z.id === a.elementId);
		const shaftCell = haus.traeger.zellen.find(
			(z) => z.nutzung === 'schacht' && z.flaechen.some((id) => cell?.flaechen.includes(id))
		);
		if (shaftCell) kanten.push([shaft, a.id]);
		for (const b of rooms)
			if (a.id < b.id && a.wandIds.some((id) => b.wandIds.includes(id))) kanten.push([a.id, b.id]);
	}
	if (haus.familie === 'wabe') {
		const levels = [...new Set(rooms.map((a) => a.z))].sort((a, b) => a - b);
		levels.forEach((z, i) =>
			kanten.push([i ? `schacht:${levels[i - 1]}` : haus.eingang.id, `schacht:${z}`])
		);
	}
	const erreichbar = new Set([haus.eingang.id]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const [a, b] of kanten)
			if (erreichbar.has(a) !== erreichbar.has(b)) {
				erreichbar.add(a);
				erreichbar.add(b);
				changed = true;
			}
	}
	return { punkte, kanten, erreichbar: [...erreichbar].sort() };
}
