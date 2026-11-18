import type { FormId } from './materialSeite';

/** Section anchors and one-line captions of the Material page: the picker first, then six layer demos. */

/** The live picker. Keeps the families lab's public anchor so that old links land on it. */
export const pickerAbschnitt = { id: 'material-familien', titel: 'Material picker' };

/** One layer demo card: stable anchor, short heading, one caption line. */
export type DemoKarteText = { id: string; titel: string; text: string };

export const farbZielKarte: DemoKarteText = {
	id: 'material-farbziel',
	titel: 'Where color goes',
	text: 'One flow, three skins. Switch it on: glaze takes the pigment; glass and brass keep their own color, so the base ring carries it.'
};

export const formKarte: DemoKarteText = {
	id: 'material-formen',
	titel: 'Form and stock',
	text: 'The picked skin on box, dome and tower. Its pattern runs in world meters, without seams. Existing stock stays white. Pick one form to see it close.'
};

export const rezeptKarte: DemoKarteText = {
	id: 'material-rezept',
	titel: 'The diagram recipe',
	text: 'Six nodes build the picked material as a diagram: tone, color, noise, joints, edge, skin.'
};

export const farbeKarte: DemoKarteText = {
	id: 'material-farbe',
	titel: 'Color and material',
	text: 'Material is depth, color is role. Then four roles in one building.'
};

export const wasserKarte: DemoKarteText = {
	id: 'material-wasser',
	titel: 'Water',
	text: 'The one surface with time: ripples cross a shallow basin. It always carries its own blue: light and clear from above, darker and mirrored at a grazing view.'
};

export const stufenKarte: DemoKarteText = {
	id: 'material-stufen',
	titel: 'Material recedes',
	text: 'With distance, surface detail drops away until only structure and then a ghost remain.'
};

/** One option of a demo's local control: value and visible label. */
export type DemoOption<T extends string = string> = { value: T; label: string };

/** Color-target demo: the same three houses without and with the flow color. */
export const farbZielSchalter: readonly DemoOption<'natur' | 'people'>[] = [
	{ value: 'natur', label: 'Natural' },
	{ value: 'people', label: 'People' }
];

/** Form demo: all four forms in a row, or one of them framed close. `alle` shows the row. */
export const formFokus: readonly DemoOption<'alle' | FormId>[] = [
	{ value: 'alle', label: 'All' },
	{ value: 'box', label: 'Box' },
	{ value: 'kuppel', label: 'Dome' },
	{ value: 'turm', label: 'Tower' },
	{ value: 'bestand', label: 'On stock' }
];

/** Water demo: viewing heights in degrees above the horizon; reflection grows toward grazing. */
export const wasserBlicke: readonly (DemoOption & { hoeheDeg: number })[] = [
	{ value: 'oben', label: 'From above', hoeheDeg: 62 },
	{ value: 'schraeg', label: 'Oblique', hoeheDeg: 28 },
	{ value: 'flach', label: 'Grazing', hoeheDeg: 12 }
];
