/**
 * Forms and scenes of the Material page: parts in meters (x right, y depth, z up; position =
 * center of the footprint). Every piece carries its recipe. Pure, without three.js; the stage
 * builds geometry from it. Everything is a function of the inputs, without randomness.
 */
import type { FamilieId, FarbePhaseId, FormId } from '../../data/materialSeite';
import type { MaterialVariation } from './variation';
import type { FlowId } from '../../data/focus';
import { bisKnoten, rezept, voreinstellung, type Rezept, type Strom } from './rezept';

export type Vec3 = [number, number, number];
export type TeilArt = 'quader' | 'zylinder' | 'kuppel' | 'kugel';
/** Role of a part: new (carries the chosen material), existing stock, core inside the existing stock. */
export type TeilRolle = 'neu' | 'bestand' | 'kern';
/** Physical profiles use the same meter hull as the legacy part; no rotation or hull expansion. */
export type StudienProfil =
	| { art: 'fase'; radius: number }
	| { art: 'lochplatte' }
	| {
			art: 'fassade';
			quer?: boolean;
			/** Left and bottom offsets, width and height as fractions of the panel. */
			fenster?: readonly (readonly [number, number, number, number])[];
	  }
	| { art: 'faltblech' | 'wellenplatte' | 'folie' | 'facetten' }
	| { art: 'rohr' | 'flor'; wand: number }
	/** `kreuz` turns the shallow pillow into a deep four-lobed enclosure with fitted seams. */
	| { art: 'kissen' | 'naht'; form?: 'kreuz' }
	/** Angular block: the hull with seeded chamfered corners, all faces planar. */
	| { art: 'brocken'; saat: number }
	| { art: 'paneele'; felder: readonly (readonly Vec3[])[] }
	| { art: 'streben'; kanten: readonly (readonly [Vec3, Vec3])[]; radius: number }
	| { art: 'lackfilm'; saat: number };
export type Teil = {
	art: TeilArt;
	/** quader: width, depth, height · zylinder: radius, –, height · kuppel and kugel: radius. */
	mass: Vec3;
	lage: Vec3;
	rolle: TeilRolle;
	profil?: StudienProfil;
};
export type Stueck = {
	id: string;
	teil: Teil;
	rezept: Rezept;
	/** Entrance share, 0–1. */
	skala?: number;
	variation?: MaterialVariation;
	ausfuehrung?: import('../../data/materialAusfuehrung').AusfuehrungId;
};

const q = (mass: Vec3, lage: Vec3, rolle: TeilRolle = 'neu'): Teil => ({
	art: 'quader',
	mass,
	lage,
	rolle
});
const z = (r: number, h: number, lage: Vec3, rolle: TeilRolle = 'neu'): Teil => ({
	art: 'zylinder',
	mass: [r, r, h],
	lage,
	rolle
});
const k = (r: number, lage: Vec3, rolle: TeilRolle = 'neu'): Teil => ({
	art: 'kuppel',
	mass: [r, r, r],
	lage,
	rolle
});

/** The four forms of the material studies. */
export function form(id: FormId): Teil[] {
	switch (id) {
		case 'box':
			return [q([4, 4, 4], [0, 0, 0])];
		case 'kuppel':
			return [z(2.9, 0.5, [0, 0, 0]), k(2.6, [0, 0, 0.5])];
		case 'turm':
			return [
				q([3.2, 3.2, 2.8], [0, 0, 0]),
				q([3.8, 2.4, 2.4], [0.5, -0.2, 2.8]),
				z(1.3, 2.4, [-0.4, 0.3, 5.2]),
				k(1.3, [-0.4, 0.3, 7.6])
			];
		case 'bestand':
			return [
				q([6, 4.4, 6], [0, 0, 0], 'bestand'),
				q([2, 2, 5.6], [0.6, 0, 0.2], 'kern'),
				q([4, 3.2, 2.8], [0.6, 0, 6]),
				z(0.9, 8.8, [-3.9, -1.2, 0])
			];
	}
}

/** Projects the first n recipe nodes (1–6) on a box, plinth and dome in stable order. */
export function knotenSzene(voll: Rezept, n: number): Stueck[] {
	const r = bisKnoten(voll, n);
	return [
		{ id: 'r-box', teil: q([3.4, 3.4, 3.4], [-2.5, 0, 0]), rezept: r },
		{ id: 'r-sockel', teil: z(2.1, 0.4, [2.7, 0, 0]), rezept: r },
		{ id: 'r-kuppel', teil: k(1.9, [2.7, 0, 0.4]), rezept: r }
	];
}

/** Staggered entrance: piece i of n grows in during the first quarter of the phase. */
export const auftritt = (i: number, n: number, anteil: number) => {
	const t = (anteil - (i / Math.max(1, n)) * 0.18) / 0.06;
	return Math.max(0, Math.min(1, t));
};

const stroeme: FlowId[] = ['people', 'water', 'energy', 'food', 'material'];

/** Color × material: a row of identical volumes or a building. */
export function farbeSzene(phase: FarbePhaseId, anteil = 1): Stueck[] {
	const modul = (x: number): Teil => q([2.2, 2.2, 2.8], [x, 0, 0]);
	if (phase === 'material') {
		const reihe: FamilieId[] = ['metall', 'keramik', 'kunststoff', 'beton'];
		return reihe.map((f, i) => ({
			id: `m-${i}`,
			teil: modul((i - 1.5) * 3.2),
			rezept: rezept(f, voreinstellung(f, 'water')),
			skala: auftritt(i, reihe.length, anteil)
		}));
	}
	if (phase === 'farbe')
		return stroeme.map((s, i) => ({
			id: `f-${i}`,
			teil: modul((i - 2) * 3.2),
			rezept: rezept('metall', voreinstellung('metall', s)),
			skala: auftritt(i, stroeme.length, anteil)
		}));
	const teile: [Teil, FamilieId, Strom][] = [
		[q([4.4, 4.4, 2.6], [0, 0, 0]), 'beton', 'neutral'],
		[q([1.8, 1.8, 2.8], [0, 0, 2.6]), 'metall', 'energy'],
		[q([3.8, 3.8, 3], [0, 0, 2.6]), 'kunststoff', 'energy'],
		[z(0.7, 7.4, [-2.9, 1.6, 0]), 'metall', 'people'],
		[z(1.6, 0.4, [0, 0, 5.6]), 'beton', 'neutral'],
		[k(1.5, [0, 0, 6]), 'keramik', 'water']
	];
	return teile.map(([teil, f, s], i) => ({
		id: `h-${i}`,
		teil,
		rezept: rezept(f, voreinstellung(f, s)),
		skala: auftritt(i, teile.length, anteil)
	}));
}
