/**
 * Material per construction type (Material page, section on detail levels). Facts and copy only:
 * which component of a structural family is made of which material family. No separate material
 * system is created; every recipe comes from data/materialSeite.ts.
 * Concept: docs/research/119-formensprache-traegerfamilien.md §3 "Materialstufen".
 */
import type { TraegerFamilieText } from './traeger';
import type { FamilieId, Phase, StufePhaseId } from './materialSeite';

/** Components of a structural plan: edge roles, hub and surface roles. */
export type Bauteil =
	'stab' | 'nebenstab' | 'rippe' | 'falz' | 'nabe' | 'paneel' | 'glas' | 'membran' | 'boden';

export type BauweiseMaterial = {
	id: TraegerFamilieText;
	/** Values that differ from the family's final image: compact, so the material stays readable. */
	werte: Record<string, number>;
	teile: Partial<Record<Bauteil, FamilieId>>;
	/** One sentence: what the construction type is made of. */
	satz: string;
};

/** Glass stays colorless. An occupied glass surface therefore becomes a plastic envelope. */
export const BELEGTES_GLAS: FamilieId = 'kunststoff';

export const bauweisen: BauweiseMaterial[] = [
	{
		id: 'gitterschale',
		werte: { maschen: 8 },
		teile: { rippe: 'holz', membran: 'membran' },
		satz: 'Gridshell: timber laths with a membrane on top. Where it collects energy or water, the membrane carries color.'
	},
	{
		id: 'kuppel',
		werte: { radius: 9 },
		teile: { stab: 'metall', nabe: 'metall', glas: 'glas', paneel: 'keramik', boden: 'beton' },
		satz: 'Dome: metal struts and hubs with glass in between. Closed panels are ceramic in the color of their flow.'
	},
	{
		id: 'faltwerk',
		werte: { bahnen: 4, felder: 4 },
		teile: { falz: 'metall', paneel: 'holz', glas: 'glas', boden: 'beton' },
		satz: 'Folded plate: timber panels, edged in metal along the mountain folds. The floor is concrete.'
	},
	{
		id: 'wabe',
		werte: { ringe: 1, lagen: 3, stufen: 1 },
		teile: { stab: 'holz', nebenstab: 'holz', glas: 'glas', boden: 'beton' },
		satz: 'Honeycomb: timber posts and beams, concrete slabs, glass walls. Occupied cells are wrapped in plastic.'
	},
	{
		id: 'raumfachwerk',
		werte: { felder: 3, tiefe: 2, lagen: 2, belegung: 0.35 },
		teile: {
			stab: 'metall',
			nebenstab: 'metall',
			nabe: 'metall',
			paneel: 'kunststoff',
			boden: 'holz'
		},
		satz: 'Space frame: one strut and one node, both metal. The plugged-in rooms are plastic capsules on timber decks.'
	}
];

export const bauweiseWahl = { label: 'Construction type' } as const;

/** Steps of the loop: same sequence as the material detail levels. */
export const tragwerkStufen: (Phase & { id: StufePhaseId })[] = [
	{
		id: 'nah',
		titel: 'Near',
		text: 'At the node, every part shows its recipe: wood grain, brushed finish, gloss.'
	},
	{
		id: 'mittel',
		titel: 'Mid',
		text: 'Noise and joints drop away. Color, tone and skin remain.'
	},
	{ id: 'fern', titel: 'Far', text: 'The whole structure: only color, tone and edge remain.' },
	{ id: 'linie', titel: 'Line', text: 'The surface becomes paper. Strut and edge carry the form.' },
	{
		id: 'geist',
		titel: 'Ghost',
		text: 'The envelope turns milky and half transparent. The structure behind it stays in place.'
	}
];
