/**
 * Function of an intervention → color and crown. The group of an occupancy is its function.
 * Colors come from the single web palette via the flows (data/focus.ts → flowToken):
 * deterministic and tied to function, never random. Without a function: ink.
 */
import { flowToken } from '../../../data/focus';
import type { ColorToken } from '../types';
import { BAHN, WEG } from './state';

export type FunktionId =
	'tinte' | 'wohnen' | 'wasser' | 'energie' | 'nahrung' | 'material' | 'kreislauf';

export type Funktion = {
	id: FunktionId;
	label: string;
	/** Color; `null` = ink (paper surface, ink line). */
	token: ColorToken | null;
	/** Form family of the crown from the form vocabulary (formen/). */
	kopf: string;
	/** Parameters for the crown family. */
	kopfParams?: Record<string, number>;
};

const flow = (id: keyof typeof flowToken) => flowToken[id] as ColorToken;

export const funktionen: Funktion[] = [
	{ id: 'tinte', label: 'Ink', token: null, kopf: 'kopf-hut', kopfParams: { typ: 0 } },
	{
		id: 'wohnen',
		label: 'Housing',
		token: flow('people'),
		kopf: 'vegetation-kugelbaum',
		kopfParams: { anzahl: 3, groesse: 0.8 }
	},
	{ id: 'wasser', label: 'Water', token: flow('water'), kopf: 'kopf-kuppel' },
	{ id: 'energie', label: 'Energy', token: flow('energy'), kopf: 'kopf-solarfeld' },
	{
		id: 'nahrung',
		label: 'Food',
		token: flow('food'),
		kopf: 'huelle-gewaechshaus',
		kopfParams: { sockel: 0, rippen: 4 }
	},
	{
		id: 'material',
		label: 'Material',
		token: flow('material'),
		kopf: 'kopf-hut',
		kopfParams: { typ: 1 }
	}
];

/** Function of a group; unknown groups (also 'eingriff') are ink. */
export const funktion = (group: string | undefined): Funktion =>
	funktionen.find((f) => f.id === group) ?? funktionen[0];

/** Color of a group for the slot context (`null` = ink). */
export const groupToken = (group: string | undefined): ColorToken | null =>
	// Paths carry people: color of the "People" flow. The track stays ink.
	group === WEG ? flow('people') : group === BAHN ? '--paper' : funktion(group).token;

/** Coloring of a scene: group → color, plus the frame color. Without it `groupToken` applies. */
export type Farben = {
	token: (group: string | undefined) => ColorToken | null;
	frame?: ColorToken;
	/** Color of all external stairs; without it, the color of the target or the accent. */
	treppe?: ColorToken;
};
