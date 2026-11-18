/** Section anchors and one-line captions of the Material page: the picker first, then six layer demos. */

/** The live picker. Keeps the families lab's public anchor so that old links land on it. */
export const pickerAbschnitt = { id: 'material-familien', titel: 'Material picker' };

/** One layer demo card: stable anchor, short heading, one caption line. */
export type DemoKarteText = { id: string; titel: string; text: string };

export const farbZielKarte: DemoKarteText = {
	id: 'material-farbziel',
	titel: 'Where color goes',
	text: 'One flow, three skins. Glaze takes the pigment; glass and brass keep their own color, so door, cornice and plinth carry it.'
};

export const formKarte: DemoKarteText = {
	id: 'material-formen',
	titel: 'Form and stock',
	text: 'The picked skin on box, dome and tower. Its pattern runs in world meters, without seams. Existing stock stays white.'
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
	text: 'The one surface with time: ripples cross a shallow basin. It always carries its own blue.'
};

export const stufenKarte: DemoKarteText = {
	id: 'material-stufen',
	titel: 'Material recedes',
	text: 'With distance, surface detail drops away until only structure and then a ghost remain.'
};
