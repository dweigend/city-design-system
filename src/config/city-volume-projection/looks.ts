import { defineSettings, settingValues } from '../setting';

/** Drawing weights by body display level and lattice member rank. */
export const lookSettings = defineSettings({
	bodyFillOpacity: {
		value: [1, 1, 0.6, 0.8],
		unit: 'ratio',
		meaning: 'Envelope opacity for full, solid, ghost, and pencil',
		rationale:
			'Focused and solid bodies read as opaque masses while the ghost treatment lets the plan show through.'
	},
	bodyRoofLightness: {
		value: [0.08, 0.03, 0.035, 0.035],
		unit: 'Oklab lightness',
		meaning: 'Roof lightness offset for full, solid, ghost, and pencil',
		rationale: 'Gives roof, lit wall, and shaded wall distinct values in each treatment.'
	},
	bodyLitLightness: {
		value: [-0.03, -0.04, -0.035, -0.03],
		unit: 'Oklab lightness',
		meaning: 'Lit wall lightness offset for full, solid, ghost, and pencil',
		rationale: 'Gives roof, lit wall, and shaded wall distinct values in each treatment.'
	},
	bodyShadeLightness: {
		value: [-0.14, -0.11, -0.12, -0.1],
		unit: 'Oklab lightness',
		meaning: 'Shaded wall lightness offset for full, solid, ghost, and pencil',
		rationale: 'Gives roof, lit wall, and shaded wall distinct values in each treatment.'
	},
	bodyRoofOpacity: {
		value: [0.95, 0.85, 0.88, 0.95],
		unit: 'ratio',
		meaning: 'Roof edges opacity for full, solid, ghost, and pencil',
		rationale: 'The roof outline carries the stepped mass.'
	},
	bodyRoofWidthPx: {
		value: [1.05, 0.85, 0.8, 0.95],
		unit: 'CSS px',
		meaning: 'Roof edges width for full, solid, ghost, and pencil',
		rationale: 'The roof outline carries the stepped mass.'
	},
	bodyWallsOpacity: {
		value: [0.8, 0.6, 0.62, 0.8],
		unit: 'ratio',
		meaning: 'Wall edges opacity for full, solid, ghost, and pencil',
		rationale: 'Wall corners remain visible beneath the stronger roof outline.'
	},
	bodyWallsWidthPx: {
		value: [0.8, 0.65, 0.62, 0.75],
		unit: 'CSS px',
		meaning: 'Wall edges width for full, solid, ghost, and pencil',
		rationale: 'Wall corners remain visible beneath the stronger roof outline.'
	},
	bodyStoreysOpacity: {
		value: [0.42, 0, 0, 0.4],
		unit: 'ratio',
		meaning: 'Storey strokes opacity for full, solid, ghost, and pencil',
		rationale: 'Focused and pencil bodies show the inner structure.'
	},
	bodyStoreysWidthPx: {
		value: [0.6, 0.5, 0.5, 0.55],
		unit: 'CSS px',
		meaning: 'Storey strokes width for full, solid, ghost, and pencil',
		rationale: 'Focused and pencil bodies show the inner structure.'
	},
	bodyJointsOpacity: {
		value: [0.32, 0, 0, 0],
		unit: 'ratio',
		meaning: 'Roof joints opacity for full, solid, ghost, and pencil',
		rationale: 'Only the focused body shows the plan cell joints.'
	},
	bodyJointsWidthPx: {
		value: [0.55, 0.5, 0.5, 0.5],
		unit: 'CSS px',
		meaning: 'Roof joints width for full, solid, ghost, and pencil',
		rationale: 'Only the focused body shows the plan cell joints.'
	},
	bodyHiddenShare: {
		value: [0, 0, 0.3, 0.32],
		unit: 'ratio',
		meaning: 'Stroke opacity retained behind nearer bodies for full, solid, ghost, and pencil',
		rationale: 'Lets ghost and pencil treatments show a faint covered outline.'
	},
	bodyRecedeShare: {
		value: [0.25, 0.3, 0.35, 0.3],
		unit: 'ratio',
		meaning: 'Stroke opacity lost at the far end of the view for full, solid, ghost, and pencil',
		rationale: 'Lets the linework recede with the depth of the picture.'
	},
	bodyHatchStrength: {
		value: [0, 0, 0, 1],
		unit: 'ratio',
		meaning: 'Shadow-side hatch strength for full, solid, ghost, and pencil',
		rationale: 'Reserves full hatching for the pencil treatment.'
	},
	bodyShadeStrength: {
		value: [1, 0.9, 0.6, 0.75],
		unit: 'ratio',
		meaning: 'Ground shade strength for full, solid, ghost, and pencil',
		rationale: 'Grounds the focused body while keeping the stock treatment quiet.'
	},
	memberOpacity: {
		value: [0.9, 0.55, 1],
		unit: 'ratio',
		meaning: 'Opacity of floor chord, upright, and model-specific member strokes',
		rationale: 'Keeps broad floor chords and model-specific lines visible beside quieter uprights.'
	},
	memberWidthPx: {
		value: [1, 0.65, 1.1],
		unit: 'CSS px',
		meaning: 'Stroke width of floor chord, upright, and model-specific member strokes',
		rationale: 'Distinguishes common uprights from the weight of model-specific members.'
	},
	memberHiddenShare: {
		value: [0.4, 0.25, 0.65],
		unit: 'ratio',
		meaning:
			'Opacity retained behind a body of floor chord, upright, and model-specific member strokes',
		rationale: 'Lets model-specific members remain recognizable through the veil.'
	},
	memberRecedeShare: {
		value: [0.4, 0.45, 0.2],
		unit: 'ratio',
		meaning:
			'Opacity lost at the far end of the picture of floor chord, upright, and model-specific member strokes',
		rationale: 'Keeps repetitive uprights quieter in the distance.'
	},
	silhouetteOverLatticeOpacity: {
		value: 0.85,
		unit: 'ratio',
		meaning: 'Envelope silhouette opacity over visible lattice',
		rationale: 'Keeps the envelope outline stronger than its interior lines.'
	},
	silhouetteOverLatticeWidthPx: {
		value: 1.35,
		unit: 'CSS px',
		meaning: 'Envelope silhouette width over visible lattice',
		rationale: 'Keeps the envelope outline stronger than its interior lines.'
	}
});

const defaults = settingValues(lookSettings);

/** Face values of a body as Oklab lightness offsets of its color: light roofs, a lit wall and a
 * wall in shade, so every body shows two or three clear values. */
export type FaceValues = Readonly<{ top: number; lit: number; shadow: number }>;

/** One drawing weight: opacity share and width in CSS pixels. */
export type Stroke = Readonly<{ opacity: number; width: number }>;

/** How a district body reads at one visible level. */
export type BodyLook = Readonly<{
	/** Neutral stock surface the level draws with; none keeps the district color. */
	surface?: 'veil' | 'pencil';
	/** Opacity share of the fill. */
	fill: number;
	faces: FaceValues;
	/** Roof edges at steps and borders, and the roof ring of a box: the strongest line. */
	roof: Stroke;
	/** Wall corners and the ground line of a body. */
	walls: Stroke;
	/** Level lines on the walls. */
	storeys: Stroke;
	/** Plan cell joints across a roof of equal height. */
	joints: Stroke;
	/** Share of a stroke's opacity kept where a nearer body covers it. */
	hidden: number;
	/** Share of a stroke's opacity the farthest stroke of the picture loses. */
	recede: number;
	/** Strength of pencil hatching on the faces turned from the sun. */
	hatch: number;
	/** Strength of the ground shade under the body. */
	shade: number;
}>;

function bodyLook(index: 0 | 1 | 2 | 3, surface?: BodyLook['surface']): BodyLook {
	return {
		...(surface ? { surface } : {}),
		fill: defaults.bodyFillOpacity[index],
		faces: {
			top: defaults.bodyRoofLightness[index],
			lit: defaults.bodyLitLightness[index],
			shadow: defaults.bodyShadeLightness[index]
		},
		roof: { opacity: defaults.bodyRoofOpacity[index], width: defaults.bodyRoofWidthPx[index] },
		walls: { opacity: defaults.bodyWallsOpacity[index], width: defaults.bodyWallsWidthPx[index] },
		storeys: {
			opacity: defaults.bodyStoreysOpacity[index],
			width: defaults.bodyStoreysWidthPx[index]
		},
		joints: {
			opacity: defaults.bodyJointsOpacity[index],
			width: defaults.bodyJointsWidthPx[index]
		},
		hidden: defaults.bodyHiddenShare[index],
		recede: defaults.bodyRecedeShare[index],
		hatch: defaults.bodyHatchStrength[index],
		shade: defaults.bodyShadeStrength[index]
	};
}

/** Body drawing weights in the display order used by the settings. */
export const bodyLooks = {
	full: bodyLook(0),
	solid: bodyLook(1, 'veil'),
	ghost: bodyLook(2, 'veil'),
	pencil: bodyLook(3, 'pencil')
} as const;

/** How a member rank draws: opacity share, width in CSS pixels, the share kept behind a body and
 * the share lost at the far end of the picture. */
export type MemberLook = Readonly<{
	opacity: number;
	width: number;
	hidden: number;
	recede: number;
}>;

function memberLook(index: 0 | 1 | 2): MemberLook {
	return {
		opacity: defaults.memberOpacity[index],
		width: defaults.memberWidthPx[index],
		hidden: defaults.memberHiddenShare[index],
		recede: defaults.memberRecedeShare[index]
	};
}

/** Drawing weights for floor chords, common uprights, and model-specific members. */
export const memberLooks = {
	lattice: memberLook(0),
	uprights: memberLook(1),
	detail: memberLook(2)
} as const;

/** The envelope outline over a visible lattice. */
export const silhouetteOverLattice: Stroke = {
	opacity: defaults.silhouetteOverLatticeOpacity,
	width: defaults.silhouetteOverLatticeWidthPx
};
