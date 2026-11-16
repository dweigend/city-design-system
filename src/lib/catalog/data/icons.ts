/**
 * Icon language: drawings of the domain icons as data.
 * Grid 24 × 24, drawing area 2…22, one 1.5 px stroke at every size.
 * UI icons come from Lucide (ISC) and share its grid, caps and joins.
 * Rules and rationale: data/icon-regeln.ts and the /interface page.
 */
import type { FlowId } from './focus';

export const ICON_RASTER = 24;
/** Margin: drawings stay within 2…22. */
export const ICON_RAND = 2;
/** Stroke width in px, independent of size. */
export const ICON_STRICH = 1.5;
export const ICON_GROESSEN = [16, 20, 24, 48] as const;
export type IconGroesse = (typeof ICON_GROESSEN)[number];

/**
 * A drawing made of up to three layers (SVG paths on the 24 grid).
 * `linie`: stroke only. `flaeche`: closed shape that can take a semantic color.
 * `masse`: closed shape in ink; it shows what is meant.
 */
export type IconZeichnung = { linie?: string; flaeche?: string; masse?: string };

/** Form groups, axonometric (2:1). Key: group ID from data/formen.ts. */
export const formIcons: Readonly<Record<string, IconZeichnung>> = {
	klotz: {
		flaeche: 'M12 2l8 4v12l-8 4-8-4V6z',
		linie: 'M4 6l8 4 8-4M12 10v12'
	},
	zylinder: {
		flaeche: 'M4 6a8 4 0 0 1 16 0v12a8 4 0 0 1-16 0z',
		linie: 'M4 6a8 4 0 0 0 16 0'
	},
	kapsel: {
		flaeche: 'M5.75 9.5l8-4a5 5 0 0 1 4.5 9l-8 4a5 5 0 0 1-4.5-9z',
		linie: 'M5.75 9.5a5 3 63.4 0 1 4.5 9'
	},
	bogen: {
		flaeche:
			'M2 15C2 10 4.7 7.3 8 9c3.3 1.7 6 7 6 12l8-4c0-5-2.7-10.3-6-12-1.2-.6-2.3-.6-3.3-.2l-8 4C3 10 2 12 2 15z',
		linie: 'M2 15l8.3-4.15'
	},
	rahmen: {
		linie: 'M12 2l8 4v12l-8 4-8-4V6zM4 6l8 4 8-4M4 18l8-4 8 4M12 2v20'
	},
	ring: {
		flaeche: 'M2 10a10 5 0 0 1 20 0v4a10 5 0 0 1-20 0zM7 10a5 2.5 0 0 0 10 0 5 2.5 0 0 0-10 0z',
		linie: 'M2 10a10 5 0 0 0 20 0'
	},
	rohr: {
		flaeche: 'M3.4 12.5l15-7.5a2.5 1.5 63.4 0 1 2.2 4.5l-15 7.5a2.5 1.5 63.4 0 1-2.2-4.5z',
		linie:
			'M3.4 12.5a2.5 1.5 63.4 0 1 2.2 4.5M8.4 10a2.5 1.5 63.4 0 1 2.2 4.5M13.4 7.5a2.5 1.5 63.4 0 1 2.2 4.5M10.6 14.5V21M15.6 12v6.5'
	},
	kopf: {
		flaeche: 'M12 2L3.8 10.2A9 4.5 0 1 0 20.2 10.2z',
		linie: 'M6 15.4V19a6 3 0 0 0 12 0v-3.6'
	},
	huelle: {
		flaeche: 'M3 18v-7a9 9 0 0 1 18 0v7a9 4 0 0 1-18 0z',
		linie: 'M8 13l4-2 4 2v4l-4 2-4-2zM8 13l4 2 4-2M12 15v4'
	},
	erschliessung: {
		linie:
			'M2 8l5 2.5V15l5 2.5V22M12 3l5 2.5V10l5 2.5V17M2 8l10-5M7 10.5l10-5M7 15l10-5M12 17.5l10-5M12 22l10-5'
	},
	vegetation: {
		flaeche: 'M12 2a6.5 6.5 0 1 0 0 13 6.5 6.5 0 1 0 0-13z',
		linie: 'M12 15v4.5M12 17l5 2.5-5 2.5-5-2.5z'
	},
	bestand: {
		linie: 'M3 18v-6l4-3 4 7v6zM7 9l10-5 4 7v6l-10 5M11 16l10-5'
	}
};

/** Flows as flat signs. The fill carries the flow color (flowToken). */
export const stromIcons: Readonly<Record<FlowId, IconZeichnung>> = {
	people: {
		flaeche: 'M12 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7zM4.5 21a7.5 7.5 0 0 1 15 0z'
	},
	water: {
		flaeche: 'M12 2l5.9 9.2a7 7 0 1 1-11.8 0z'
	},
	energy: {
		flaeche: 'M14 2L4 14h7l-1 8 10-12h-7z'
	},
	food: {
		flaeche: 'M12 16a8 8 0 0 1-8-8 8 8 0 0 1 8 8zM12 11a8 8 0 0 0 8-8 8 8 0 0 0-8 8z',
		linie: 'M12 22V11'
	},
	material: {
		flaeche: 'M3 12h9v8H3zM12 12h9v8h-9zM7.5 4h9v8h-9z'
	}
};

export type BauzoneId = 'sockel' | 'geschosse' | 'dach' | 'freiraum';
export type Bauzone = { id: BauzoneId; name: string; text: string };

/** Four zones of a building volume, bottom to top, plus the space between volumes. */
export const bauzonen: Bauzone[] = [
	{ id: 'sockel', name: 'Plinth zone', text: 'Public, at ground level, often existing stock.' },
	{ id: 'geschosse', name: 'Program floors', text: 'The microcosm stack.' },
	{ id: 'dach', name: 'Roof zone', text: 'The top: crown, garden, solar field.' },
	{ id: 'freiraum', name: 'Open space', text: 'Between the volumes: square, courtyard, alley.' }
];

/** One section figure for every zone: the drawing stays, the black fill moves. */
const ZONEN_FIGUR = 'M2 21h20M3 21v-5h11v5M5 16V7h7v9M5 7a3.5 3.5 0 0 1 7 0M22 9h-3v12';

export const zonenIcons: Readonly<Record<BauzoneId, IconZeichnung>> = {
	sockel: { linie: ZONEN_FIGUR, masse: 'M3 16h11v5H3z' },
	geschosse: { linie: ZONEN_FIGUR, masse: 'M5 7h7v9H5z' },
	dach: { linie: ZONEN_FIGUR, masse: 'M5 7a3.5 3.5 0 0 1 7 0z' },
	freiraum: { linie: ZONEN_FIGUR, masse: 'M14 19h5v2h-5z' }
};

export type KontextregelId = 'hofgarten' | 'arkade' | 'bruecke' | 'kai' | 'dachgarten' | 'pilotis';
export type Kontextregel = { id: KontextregelId; name: string; text: string; ansicht: string };

/** Examples of context rules: the neighborhood triggers the component. */
export const kontextregeln: Kontextregel[] = [
	{
		id: 'hofgarten',
		name: 'Courtyard garden',
		text: 'A block around a void: the void becomes a garden.',
		ansicht: 'Plan'
	},
	{
		id: 'arkade',
		name: 'Arcade',
		text: 'A plinth on a public path: the plinth opens up.',
		ansicht: 'Elevation'
	},
	{
		id: 'bruecke',
		name: 'Bridge',
		text: 'Two volumes across an open gap: a deck connects them.',
		ansicht: 'Section'
	},
	{
		id: 'kai',
		name: 'Quay and footbridge',
		text: 'An edge on the water: a footbridge leads out.',
		ansicht: 'Section'
	},
	{
		id: 'dachgarten',
		name: 'Roof garden',
		text: 'An open flat roof: it gets planted.',
		ansicht: 'Section'
	},
	{
		id: 'pilotis',
		name: 'Pilotis',
		text: 'A volume hovering above the ground: columns carry it.',
		ansicht: 'Section'
	}
];

export const regelIcons: Readonly<Record<KontextregelId, IconZeichnung>> = {
	hofgarten: {
		linie: 'M3 3h18v18H3zM8 8h8v8H8z',
		masse: 'M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z'
	},
	arkade: {
		linie: 'M2 21h20M2 11V4M22 11V4',
		masse: 'M2 11h20v10h-4v-4a2 2 0 0 0-4 0v4h-4v-4a2 2 0 0 0-4 0v4H2z'
	},
	bruecke: {
		linie: 'M2 21h20M2 5h6v16M22 9h-6v12',
		masse: 'M8 12h8v2H8z'
	},
	kai: {
		linie: 'M2 12h6v9M8 17q1.75-2 3.5 0t3.5 0 3.5 0 3.5 0M18 12v9',
		masse: 'M8 10h12v2H8z'
	},
	dachgarten: {
		linie: 'M2 21h20M4 21V11h16v10M9 9v2M15.5 9.5V11',
		masse: 'M9 3a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM15.5 5.5a2 2 0 1 0 0 4 2 2 0 1 0 0-4z'
	},
	pilotis: {
		linie: 'M2 21h20M3 4h18v9H3z',
		masse: 'M5 13h2v8H5zM11 13h2v8h-2zM17 13h2v8h-2z'
	}
};
