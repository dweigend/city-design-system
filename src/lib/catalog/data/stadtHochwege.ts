/** Gallery walking height above its approach datum, meters. */
export const HOCHWEG_M = 8;
/** Nodes of the elevated walkway network in meters; level 2 = gallery walkway (8 m), level 4 = rooftop walkway (16 m). Same shape as logic/bibel/wege.ts. */
export type HochwegKnoten = { id: string; x: number; y: number; ebene: number };

export type HochwegHaus = {
	breite: number;
	tiefe: number;
	geschosse: number;
	bestand: boolean;
};
export type HochwegBeispiel = {
	value: string;
	label: string;
	satz: string;
	knoten: HochwegKnoten[];
	/** Same index as the matching node. Dimensions in meters, floor height 4 m. */
	haeuser: HochwegHaus[];
};

export const hochwegBeispiele: HochwegBeispiel[] = [
	{
		value: 'blockrand',
		label: 'Perimeter block',
		satz: 'You walk the gallery around the courtyard; one extra link saves you the long way back.',
		knoten: [
			{ id: 'b1', x: -10, y: -10, ebene: 2 },
			{ id: 'b2', x: 0, y: -11, ebene: 2 },
			{ id: 'b3', x: 10, y: -10, ebene: 2 },
			{ id: 'b4', x: 11, y: 0, ebene: 2 },
			{ id: 'b5', x: 10, y: 10, ebene: 2 },
			{ id: 'b6', x: 0, y: 11, ebene: 2 },
			{ id: 'b7', x: -10, y: 10, ebene: 2 },
			{ id: 'b8', x: -11, y: 0, ebene: 2 }
		],
		haeuser: Array.from({ length: 8 }, (_, i) => ({
			breite: i % 2 ? 7 : 8,
			tiefe: i % 2 ? 6 : 7,
			geschosse: i % 3 === 1 ? 3 : 2,
			bestand: true
		}))
	},
	{
		value: 'altstadt',
		label: 'Old town',
		satz: 'You follow the staggered buildings; without its own access, the rooftop walkway stays cut off from the gallery.',
		knoten: [
			{ id: 'a1', x: -13, y: -8, ebene: 2 },
			{ id: 'a2', x: -4, y: -11, ebene: 2 },
			{ id: 'a3', x: 6, y: -9, ebene: 2 },
			{ id: 'a4', x: 14, y: -2, ebene: 2 },
			{ id: 'a5', x: 10, y: 8, ebene: 2 },
			{ id: 'a6', x: 0, y: 13, ebene: 2 },
			{ id: 'a7', x: -9, y: 9, ebene: 2 },
			{ id: 'a8', x: -15, y: 1, ebene: 2 },
			{ id: 'a9', x: 0, y: 0, ebene: 4 }
		],
		haeuser: [2, 3, 2, 2, 3, 2, 2, 3, 4].map((geschosse, i) => ({
			breite: i % 2 ? 6 : 7,
			tiefe: i % 3 ? 5 : 6,
			geschosse,
			bestand: true
		}))
	},
	{
		value: 'turmgruppe',
		label: 'Tower cluster',
		satz: 'You reach the new towers across the existing stock; up top, a second network forms with its own access points.',
		knoten: [
			{ id: 't1', x: -13, y: -10, ebene: 2 },
			{ id: 't2', x: -3, y: -12, ebene: 2 },
			{ id: 't3', x: 7, y: -10, ebene: 2 },
			{ id: 't4', x: 8, y: 0, ebene: 2 },
			{ id: 't5', x: -2, y: 1, ebene: 2 },
			{ id: 't6', x: -13, y: 0, ebene: 2 },
			{ id: 't7', x: -12, y: 12, ebene: 4 },
			{ id: 't8', x: -2, y: 13, ebene: 4 },
			{ id: 't9', x: 8, y: 12, ebene: 4 },
			{ id: 't10', x: 17, y: 5, ebene: 4 }
		],
		haeuser: [2, 2, 2, 5, 6, 2, 4, 5, 4, 4].map((geschosse, i) => ({
			breite: i < 3 || i === 5 ? 7 : 5,
			tiefe: i < 3 || i === 5 ? 6 : 5,
			geschosse,
			bestand: i < 3 || i === 5
		}))
	}
];

/**
 * First example of the demo: the five structures from the Forms page act here as nodes and
 * carriers of the network. Position and network live in logic/traeger/integration/hochwegnetz.ts.
 */
export const tragwerkBeispiel = {
	value: 'tragwerke',
	label: 'Structures',
	satz: 'You walk through the space frame across the alley, past the honeycomb’s shaft and under the gridshell straight across the courtyard.',
	bild: 'Five structures on existing stock, linked by elevated walkways at eight meters',
	unterschrift:
		'Everything new starts at eight meters: folded plate and dome on old roofs, the shell on the courtyard eaves. Where a footbridge no longer reaches, the space frame carries the path.'
} as const;

/** Caption for the three network examples. */
export const netzUnterschrift =
	'The network grows from a spanning tree to short detours; only paths on the same level connect.';
