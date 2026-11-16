/**
 * District of the color lab (page /farben): a vertical microcosm on four existing buildings.
 * Headless and deterministic. Units: meters, x/y plan, z height.
 * Every part is an axis-aligned box; paths are polylines for glowing packets.
 */
import { random } from '../parametrik/random';
import type { FlowId } from '../../data/focus';

export type Vec3 = [number, number, number];

/** How a part acts in the flow; the step "by meaning" follows from it. */
export type Art = 'reichweite' | 'flaeche' | 'volumen' | 'netz' | 'kern';

/** Step by meaning: light is surface, dark is core (data/color.ts). */
export const artStufe: Record<Art, 1 | 2 | 3 | 4 | 5> = {
	reichweite: 1,
	flaeche: 2,
	volumen: 3,
	netz: 4,
	kern: 5
};

export type Rolle = 'boden' | 'bestand' | 'neu' | 'geruest';

export type Teil = {
	id: string;
	/** Corner with the smallest coordinates, and edge lengths, meters. */
	min: Vec3;
	size: Vec3;
	rolle: Rolle;
	strom?: FlowId;
	art?: Art;
};

export type Weg = { id: string; strom: FlowId; punkte: Vec3[] };
export type Modell = { saat: number; teile: Teil[]; wege: Weg[] };

const MODUL = 8,
	GESCHOSS = 4,
	PLATTE = 0.4;
/** Tower on the existing building b-ost: base point (x, y, z) in meters. */
const TX = 21,
	TY = 2,
	FUSS = 9;

/** Program of the tower from bottom to top. */
const PROGRAMM: [FlowId, Art][] = [
	['material', 'volumen'],
	['material', 'volumen'],
	['food', 'volumen'],
	['food', 'volumen'],
	['people', 'volumen'],
	['people', 'volumen'],
	['people', 'volumen'],
	['water', 'kern'],
	['people', 'volumen']
];
const DACH = FUSS + PROGRAMM.length * GESCHOSS;
const HOCHWEG = FUSS + 5 * GESCHOSS + PLATTE;
/** Depot on the ground east of the existing stock; the transport line drops vertically at LX. */
const LAGER_X = 36,
	LX = 35;
const TANK = FUSS + 7 * GESCHOSS + 2;

/** Fixed parts: id, min, size, role, flow, kind. The order is contract (instance index). */
type Zeile = [string, Vec3, Vec3, Rolle, FlowId?, Art?];
const FEST: Zeile[] = [
	['boden', [-14, -14, -0.3], [64, 56, 0.3], 'boden'],
	['b-nord', [0, 0, 0], [14, 12, 12], 'bestand'],
	['b-ost', [18, 0, 0], [14, 12, 9], 'bestand'],
	['b-west', [0, 18, 0], [14, 12, 15], 'bestand'],
	['b-sued', [18, 18, 0], [16, 12, 6], 'bestand'],
	['kern', [TX + 3, TY + 3, FUSS], [2, 2, DACH - FUSS + 2], 'neu'],
	['solar', [TX - 1, TY - 1, DACH + 0.6], [10, 10, 0.3], 'neu', 'energy', 'netz'],
	['speicher', [TX + 9, TY + 1, FUSS], [3, 3, 3], 'neu', 'energy', 'kern'],
	['energie-reichweite', [19, 19, 6], [14, 10, 0.25], 'neu', 'energy', 'reichweite'],
	['wasser-fang', [1, 1, 12], [12, 10, 0.25], 'neu', 'water', 'flaeche'],
	['wasser-becken', [4, 13, 0], [10, 4, 0.3], 'neu', 'water', 'flaeche'],
	['hochweg', [6, 9, HOCHWEG - 0.5], [2.5, TX - 6, 0.5], 'neu', 'people', 'netz'],
	['hochweg-quer', [6, 9, HOCHWEG - 0.5], [TX - 5, 2.5, 0.5], 'neu', 'people', 'netz'],
	['treppe', [6, 15, 15], [2.5, 2.5, HOCHWEG - 15.5], 'neu', 'people', 'netz'],
	['platz', [2, 20, 15], [10, 8, 0.25], 'neu', 'people', 'flaeche'],
	['hof', [-12, 13, 0], [48, 4, 0.15], 'neu', 'people', 'reichweite'],
	['dachgarten', [2, 28, 15], [10, 1.6, 0.25], 'neu', 'food', 'flaeche'],
	['markt', [-10, 20, 0], [6, 6, 3.5], 'neu', 'food', 'kern'],
	['lager', [LAGER_X, 2, 0], [8, 10, 0.3], 'neu', 'material', 'reichweite'],
	['rohstoff', [LAGER_X + 2, 4, 0.3], [4, 3, 2.5], 'neu', 'material', 'kern'],
	['wertstoff', [TX + MODUL + 1.5, TY + 6, FUSS], [3, 3, 3], 'neu', 'material', 'kern']
];

/** Paths: lines are also built as thin boxes when `bauen` is set. */
const WEGE: (Weg & { bauen?: boolean })[] = [
	{
		// From the solar roof down the outside of the tower into the storage. Outside, so it shows:
		// modules project up to 1 m, the line runs 1.5 m beside the tower edge.
		id: 'leitung',
		strom: 'energy',
		bauen: true,
		punkte: [
			[TX + 8, TY + 2.5, DACH + 0.75],
			[TX + 10.5, TY + 2.5, DACH + 0.75],
			[TX + 10.5, TY + 2.5, FUSS + 3]
		]
	},
	{
		id: 'rohr',
		strom: 'water',
		bauen: true,
		punkte: [
			[13, 6, 12.3],
			[16, 6, 12.3],
			[16, 6, TANK],
			[TX, 6, TANK]
		]
	},
	{
		id: 'gehen',
		strom: 'people',
		punkte: [
			[TX, 10, HOCHWEG],
			[7.25, 10, HOCHWEG],
			[7.25, 18, HOCHWEG],
			[7.25, 18, 15.3]
		]
	},
	{
		id: 'ruecklauf',
		strom: 'material',
		bauen: true,
		punkte: [
			[TX + MODUL, TY + 4, FUSS + GESCHOSS + 2],
			[TX + MODUL + 3, TY + 4, FUSS + GESCHOSS + 2],
			[TX + MODUL + 3, TY + 4, FUSS + 2],
			[TX + MODUL, TY + 4, FUSS + 2]
		]
	},
	{
		// From the recyclables on the roof down the outside into the depot: first 1.5 m past the roof
		// edge, then vertically along the facade, at the ground into the raw stock. Orthogonal, so it gets built.
		id: 'transport',
		strom: 'material',
		bauen: true,
		punkte: [
			[TX + MODUL + 4.5, TY + 7.5, FUSS + 2],
			[LX, TY + 7.5, FUSS + 2],
			[LX, TY + 7.5, 1.4],
			[LAGER_X + 4, TY + 7.5, 1.4],
			[LAGER_X + 4, 7, 1.4]
		]
	}
];

const teil = ([id, min, size, rolle, strom, art]: Zeile): Teil => ({
	id,
	min,
	size,
	rolle,
	...(strom ? { strom } : {}),
	...(art ? { art } : {})
});

/** Orthogonal polyline as thin boxes (network, base tone). */
function leitung(w: Weg): Teil[] {
	const d = 0.5;
	return w.punkte.slice(1).map((b, i) => {
		const a = w.punkte[i];
		const min = a.map((v, k) => Math.min(v, b[k]) - d / 2) as Vec3;
		const size = a.map((v, k) => Math.abs(v - b[k]) + d) as Vec3;
		return { id: `${w.id}-${i + 1}`, min, size, rolle: 'neu', strom: w.strom, art: 'netz' };
	});
}

/** Structural frame in signal: four columns and four beams; the next floor takes shape. */
function geruest(): Teil[] {
	const ecken = [
		[0, 0],
		[MODUL, 0],
		[0, MODUL],
		[MODUL, MODUL]
	];
	return [
		...ecken.map(([x, y], i) => ({
			id: `geruest-${i}`,
			min: [TX + x - 0.15, TY + y - 0.15, DACH + 1] as Vec3,
			size: [0.3, 0.3, GESCHOSS] as Vec3,
			rolle: 'geruest' as const
		})),
		// Ring of four beams, no surface: signal stays a line (5 %).
		...[
			[0, 0, MODUL + 0.3, 0.3],
			[0, MODUL, MODUL + 0.3, 0.3],
			[0, 0, 0.3, MODUL + 0.3],
			[MODUL, 0, 0.3, MODUL + 0.3]
		].map(([x, y, w, d], i) => ({
			id: `geruest-riegel-${i}`,
			min: [TX + x - 0.15, TY + y - 0.15, DACH + GESCHOSS + 0.7] as Vec3,
			size: [w, d, 0.3] as Vec3,
			rolle: 'geruest' as const
		}))
	];
}

/**
 * Builds the district. The same seed yields the same parts in the same order.
 * Draw sequence: exactly two draws per tower floor (offset x, then y, each ±1 m in 0.5 m steps).
 */
export function baueQuartier(saat = 7): Modell {
	const s = saat >>> 0;
	const rnd = random(s);
	const module: Teil[] = PROGRAMM.map(([strom, art], i) => {
		const dx = Math.round((rnd() - 0.5) * 4) / 2,
			dy = Math.round((rnd() - 0.5) * 4) / 2;
		return {
			id: `modul-${i}`,
			min: [TX + dx, TY + dy, FUSS + i * GESCHOSS + PLATTE],
			size: [MODUL, MODUL, GESCHOSS - PLATTE],
			rolle: 'neu',
			strom,
			art
		};
	});
	return {
		saat: s,
		teile: [
			...FEST.map(teil),
			...module,
			...WEGE.filter((w) => w.bauen).flatMap(leitung),
			...geruest()
		],
		wege: WEGE.map(({ id, strom, punkte }) => ({ id, strom, punkte }))
	};
}
