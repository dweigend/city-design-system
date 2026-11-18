/** Specimen captions and form labels for the physical Material chapter. */
import {
	familienAbschnitt,
	farbeAbschnitt,
	rezeptAbschnitt,
	stufenAbschnitt,
	type FamilieId
} from './materialSeite';

export const laborFormen = [
	{ value: 'probe', label: 'Specimen' },
	{ value: 'montage', label: 'Assembly' }
];

/** Captions describe construction independently of the selected finish. */
export const konstruktion: Record<FamilieId, string> = {
	metall:
		'Metal study: folds, cut edges and curved sections show how the finish catches the light.',
	keramik: 'Ceramic study: joints and edges reveal the finish at a change of plane.',
	beton:
		'Assembled mineral study: solid cast pieces reveal surface texture, panel joints and edge depth.',
	kunststoff: 'Polymer study: exposed faces show how the finish behaves at edges and in light.',
	glas: 'Glazing study: the glass surface catches reflections above the layers behind it.',
	holz: 'Assembled timber study: beams and boards expose long grain, end grain and construction joints.',
	membran: 'Membrane study: the finish follows curves and softens reflections across the surface.',
	wasser:
		'Assembled water study: waves travel between the banks, with a submerged landing visible through the shallows.',
	bestand: 'Assembled stock study: a matte white architectural model with understated joints.'
};

/** Building comparison section; the anchor is public and stays stable. */
export const haeuserAbschnitt = {
	id: 'material-buildings',
	titel: 'Building studies',
	lead: 'Compare finishes on a timber house, a glass pavilion and a stepped concrete tower. The building and view stay fixed when you switch finishes.'
};

/** Divider before the explanatory studies; separates teaching from the surface workflow. */
export const erklaerungTeil = {
	id: 'material-erklaerung',
	titel: 'How it works',
	lead: 'Simplified diagram studies. They explain recipe, color and distance; the surfaces above are the reference.'
};

/** Assembly caption: which pieces take the finish and which inputs stay fixed. */
export const montageText =
	'Assembly: mineral base, metal frame, timber deck, glazing, membrane and water. Only the selected family takes the finish; flow color and fine tuning stay fixed.';

/** Page index: surface workflow first, teaching second. Every entry links a stable section anchor. */
export const materialIndex = [
	{
		id: 'material-index-oberflaechen',
		titel: 'Surfaces',
		links: [
			{ id: familienAbschnitt.id, label: 'Families and finishes' },
			{ id: haeuserAbschnitt.id, label: 'Building studies' }
		]
	},
	{
		id: 'material-index-erklaerung',
		titel: erklaerungTeil.titel,
		links: [
			{ id: rezeptAbschnitt.id, label: 'Diagram recipe' },
			{ id: farbeAbschnitt.id, label: 'Color and material' },
			{ id: stufenAbschnitt.id, label: 'Detail levels' }
		]
	}
];
