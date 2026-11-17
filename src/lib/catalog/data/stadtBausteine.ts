/**
 * Texts and sequences of the interactive city building blocks: building on existing stock, sponge
 * city, component passport. Content only, no geometry (that lives in logic/stadt/). Durations in
 * seconds. Sources: data/stadt.ts (rules), docs/research/04-city-rules.md §1.1–1.3,
 * Refunc research (offcut stays inventory, type and instance, fixed structural frame with changing
 * envelope, connection types with matching parts, existing object with a new function).
 */
import type { FlowId } from './focus';

export type LoopPhase = { id: string; titel: string; text: string; durationS: number };

/* ── Building on existing stock ──────────────────────────────────────────── */

export type LageId = 'zeile' | 'luecke' | 'hof' | 'gasse';
export type StufeId = 'behalten' | 'umbauen' | 'ergaenzen';

export const lagen: { value: LageId; label: string }[] = [
	{ value: 'zeile', label: 'Historic row' },
	{ value: 'luecke', label: 'Gap in the block' },
	{ value: 'hof', label: 'Back courtyard' },
	{ value: 'gasse', label: 'Across the alley' }
];

export const stufen: { value: StufeId; label: string; text: string }[] = [
	{
		value: 'behalten',
		label: 'Retain',
		text: 'What stands, stays: walls, roofs, trees, the alley. Gray is existing stock.'
	},
	{
		value: 'umbauen',
		label: 'Convert',
		text: 'The old building changes its use. The envelope stays; the floor takes on the color of its new job.'
	},
	{
		value: 'ergaenzen',
		label: 'Extend',
		text: 'New additions attach wherever there is room: on top, in the gap, in the courtyard. Each carries the color of its function.'
	}
];

export type Eingriff = { target: string; titel: string; text: string; strom: FlowId | null };

/** What happens in each starting situation per step. Target IDs refer to boxes in logic/stadt/weiterbauen.ts. */
export const eingriffe: Record<LageId, Record<StufeId, Eingriff[]>> = {
	zeile: {
		behalten: [
			{
				target: 'haus',
				titel: 'Four old buildings',
				text: 'Built around 1900, brick, tall floors. They can carry more than stands on them today.',
				strom: null
			},
			{
				target: 'baum',
				titel: 'Trees in the alley',
				text: 'They provide shade and stay, even when building happens above.',
				strom: null
			}
		],
		umbauen: [
			{
				target: 'werkstatt',
				titel: 'Workshop on the ground floor',
				text: 'Where a shop stood empty, things are now repaired and taken apart. Material stays in the district.',
				strom: 'material'
			},
			{
				target: 'markt',
				titel: 'Market on the ground floor',
				text: 'Vegetables from the roof gardens are sold downstairs, with no delivery route.',
				strom: 'food'
			}
		],
		ergaenzen: [
			{
				target: 'aufstockung',
				titel: 'Rooftop extension in timber',
				text: 'Two light floors on top of the existing building. They share the old stairwell.',
				strom: 'people'
			},
			{
				target: 'solar',
				titel: 'Solar roof',
				text: 'The new roof generates the power for the row.',
				strom: 'energy'
			},
			{
				target: 'dachgarten',
				titel: 'Roof garden',
				text: 'A garden bed on the last old building, the one that gets no rooftop extension.',
				strom: 'food'
			}
		]
	},
	luecke: {
		behalten: [
			{
				target: 'haus',
				titel: 'Perimeter block',
				text: 'Five buildings stand in a closed row along the alley. One parcel has been empty for decades.',
				strom: null
			},
			{
				target: 'brache',
				titel: 'The gap',
				text: 'No demolition needed: there is already room here.',
				strom: null
			}
		],
		umbauen: [
			{
				target: 'wasserwerk',
				titel: 'Water in the basement',
				text: 'The ground floor next to the gap becomes cistern and pump for the block.',
				strom: 'water'
			}
		],
		ergaenzen: [
			{
				target: 'turm',
				titel: 'Tower in the gap',
				text: 'A structural frame with housing modules, taller than its neighbors. It closes the gap without walling it up.',
				strom: 'people'
			},
			{
				target: 'steg',
				titel: 'Footbridge to the neighbor',
				text: 'At eaves height, a footbridge connects the tower to the roof next door.',
				strom: 'people'
			},
			{
				target: 'solar',
				titel: 'Solar crown',
				text: 'At its top, the tower carries the power the district needs.',
				strom: 'energy'
			}
		]
	},
	hof: {
		behalten: [
			{
				target: 'haus',
				titel: 'Three wings around a courtyard',
				text: 'The courtyard was a parking lot and storage yard, fully sealed.',
				strom: null
			},
			{
				target: 'schuppen',
				titel: 'Old shed',
				text: 'It is not torn down. Its roof and walls stay.',
				strom: null
			}
		],
		umbauen: [
			{
				target: 'entsiegelt',
				titel: 'Unsealed ground',
				text: 'The asphalt comes out. Rain now infiltrates where it falls.',
				strom: 'water'
			},
			{
				target: 'gewaechshaus',
				titel: 'Shed as greenhouse',
				text: 'Glass instead of sheet metal in the roof: herbs and tomatoes grow in the old shed.',
				strom: 'food'
			}
		],
		ergaenzen: [
			{
				target: 'becken',
				titel: 'Basin',
				text: 'It collects rain from the roofs and cools the courtyard in summer.',
				strom: 'water'
			},
			{
				target: 'galerie',
				titel: 'Gallery walkway',
				text: 'A gallery walkway at 8 meters connects the two side wings.',
				strom: 'people'
			},
			{
				target: 'beete',
				titel: 'Garden beds',
				text: 'Raised beds on the unsealed ground.',
				strom: 'food'
			}
		]
	},
	gasse: {
		behalten: [
			{
				target: 'haus',
				titel: 'Old building on the alley',
				text: 'Five floors, punched-window facade. Across the alley lies an empty parcel.',
				strom: null
			},
			{
				target: 'gasse',
				titel: 'The alley',
				text: 'It stays clear; people walk below.',
				strom: null
			}
		],
		umbauen: [
			{
				target: 'gemeinschaft',
				titel: 'Community floor',
				text: 'The third floor becomes a kitchen and hall for all the neighbors.',
				strom: 'people'
			}
		],
		ergaenzen: [
			{
				target: 'turm',
				titel: 'Tower across the alley',
				text: 'On the empty parcel, a tower with apartments and workshops grows.',
				strom: 'material'
			},
			{
				target: 'bruecke',
				titel: 'Bridge at 8 meters',
				text: 'A clear span of at most 13 meters; the alley below stays open.',
				strom: 'people'
			},
			{
				target: 'treppe',
				titel: 'Stair tower',
				text: 'Here you switch between alley and bridge.',
				strom: 'people'
			}
		]
	}
};

/* ── Sponge city ────────────────────────────────────────────────────────── */

export type RegenId = 'land' | 'stark';

export const regen: { value: RegenId; label: string }[] = [
	{ value: 'land', label: 'Steady rain' },
	{ value: 'stark', label: 'Heavy rain' }
];

export const schwammPhasen: LoopPhase[] = [
	{
		id: 'regen',
		titel: 'Rain falls',
		text: 'On roofs, courtyards and alleys. None of it should vanish straight into the sewer.',
		durationS: 4
	},
	{
		id: 'daecher',
		titel: 'Roofs hold',
		text: 'The green roof soaks itself full. What it cannot hold runs down the downspout into the cistern.',
		durationS: 4
	},
	{
		id: 'hof',
		titel: 'The courtyard infiltrates',
		text: 'Open ground and the gravel trench below absorb the water and release it slowly.',
		durationS: 4
	},
	{
		id: 'becken',
		titel: 'The basin holds back',
		text: 'It fills up and lets out only a trickle. If there is too much, it overflows into the flood swale, never into the building.',
		durationS: 4.5
	},
	{
		id: 'nutzen',
		titel: 'Use and evaporate',
		text: 'The cistern flushes and waters. Plants and basin evaporate the rest and cool the courtyard.',
		durationS: 5.5
	}
];

/* ── Component passport ─────────────────────────────────────────────────── */

export type BauteilLoopId = 'fenster' | 'platte' | 'palette';

export type PassEintrag = { jahr: string; text: string; ab: number };

export type Pass = {
	typ: string;
	nr: string;
	/** What only this instance has. */
	merkmal: string;
	herkunft: string;
	verbindung: string;
	lebenslauf: PassEintrag[];
	/** Derived piece: a separate instance made from this part, visible from phase `ab`. */
	abkoemmling?: { ab: number; typ: string; nr: string; text: string };
};

export type BauteilLoop = {
	value: BauteilLoopId;
	label: string;
	phasen: LoopPhase[];
	pass: Pass;
};

export const bauteilLoops: BauteilLoop[] = [
	{
		value: 'fenster',
		label: 'Window',
		phasen: [
			{
				id: 'pass',
				titel: 'Click the window',
				text: 'It is not just any window. It has a number, an origin and a history.',
				durationS: 3.5
			},
			{
				id: 'loesen',
				titel: 'Release the connection',
				text: 'Four screws instead of mortar: the window comes out intact. A door to the elevated walkway goes into the opening.',
				durationS: 4
			},
			{
				id: 'lager',
				titel: 'Into storage',
				text: 'Inspected, painted, stored. It remains the same instance with the same number.',
				durationS: 4
			},
			{
				id: 'einsetzen',
				titel: 'Reinstall',
				text: 'The tower has a fixed structural frame and changing infills. The window fits every bay of its size.',
				durationS: 4.5
			}
		],
		pass: {
			typ: 'Box window 110 × 180',
			nr: '0417',
			merkmal: 'Left sash with a 1974 brass handle',
			herkunft: 'Old building on the courtyard, third floor',
			verbindung: 'Four screws, detachable',
			lebenslauf: [
				{ jahr: '1928', text: 'Installed in the old building on the courtyard', ab: 0 },
				{ jahr: '1974', text: 'New handle, brass', ab: 0 },
				{ jahr: '2031', text: 'Removed; the opening becomes a door', ab: 1 },
				{ jahr: '2031', text: 'Inspected, painted, bay B3', ab: 2 },
				{ jahr: '2032', text: 'Installed in the tower on the courtyard', ab: 3 }
			]
		}
	},
	{
		value: 'platte',
		label: 'Panel',
		phasen: [
			{
				id: 'platte',
				titel: 'Panel from the attic',
				text: 'A wood panel from the attic floor, 2.50 × 1.25 m. Its passport knows the wood, age and origin.',
				durationS: 3.5
			},
			{
				id: 'zuschnitt',
				titel: 'Cut to size',
				text: 'A wall panel needs 1.60 m. It goes into a module of the tower.',
				durationS: 4
			},
			{
				id: 'rest',
				titel: 'The remnant stays in stock',
				text: 'The offcut gets its own passport that points back to the panel. It is inventory, not waste.',
				durationS: 4
			},
			{
				id: 'regal',
				titel: 'A shelf',
				text: 'The remnant becomes three shelves and two side panels: a shelf unit for the storeroom.',
				durationS: 4.5
			}
		],
		pass: {
			typ: 'Wood panel 250 × 125, spruce',
			nr: '0291',
			merkmal: 'Nail holes on a 62.5 cm grid',
			herkunft: 'Attic floor, building on the alley',
			verbindung: 'Nailed, nails pulled',
			lebenslauf: [
				{ jahr: '1996', text: 'Laid as attic flooring', ab: 0 },
				{ jahr: '2031', text: 'Removed, nails pulled', ab: 0 },
				{ jahr: '2032', text: 'Panel 160 cm for the tower', ab: 1 },
				{ jahr: '2032', text: 'Remnant stored as 0291-1', ab: 2 }
			],
			abkoemmling: {
				ab: 2,
				typ: 'Offcut 90 × 125',
				nr: '0291-1',
				text: 'From panel 0291. Becomes a shelf in 2032.'
			}
		}
	},
	{
		value: 'palette',
		label: 'Pallet',
		phasen: [
			{
				id: 'palette',
				titel: 'A pallet',
				text: 'A Euro pallet with a branded stamp. Its blocks have the same size everywhere.',
				durationS: 3.5
			},
			{
				id: 'beine',
				titel: 'Plug in the legs',
				text: 'Plug-in legs fit every block of this size. The connection needs no screw.',
				durationS: 4
			},
			{
				id: 'bank',
				titel: 'A bench in the courtyard',
				text: 'Existing object, new job: the pallet is now a bench.',
				durationS: 4
			},
			{
				id: 'zerlegen',
				titel: 'Take apart again',
				text: 'Legs off, pallet back. Both stay intact and keep their passports.',
				durationS: 4.5
			}
		],
		pass: {
			typ: 'Euro pallet 120 × 80',
			nr: '2209',
			merkmal: 'Branded stamp 2019, one board replaced',
			herkunft: 'Delivery to the market hall',
			verbindung: 'Block 145 × 100, plug-in',
			lebenslauf: [
				{ jahr: '2019', text: 'Built, stamped', ab: 0 },
				{ jahr: '2030', text: 'One top board replaced', ab: 0 },
				{ jahr: '2032', text: 'Four plug-in legs attached', ab: 1 },
				{ jahr: '2032', text: 'Bench in the courtyard', ab: 2 },
				{ jahr: '2034', text: 'Taken apart, both parts in storage', ab: 3 }
			]
		}
	}
];
