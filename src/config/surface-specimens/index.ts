import { defineSettings, settingValues } from '../setting';

const positive = { exclusiveMin: 0 } as const;

/** Sample plates and the sample body shown on the surfaces page. */
export const settings = defineSettings({
	plateTriangleBudget: {
		value: 1200,
		unit: 'triangles',
		meaning: 'Most triangles one 2 x 2 m sample plate may use',
		bounds: positive,
		principle: 'MAT-5'
	},
	bodyTriangleBudget: {
		value: 4000,
		unit: 'triangles',
		meaning: 'Most triangles one sample body with roof, openings and ground may use',
		bounds: positive,
		principle: 'MAT-5'
	},
	moduleScaleBand: {
		value: [0.5, 2, 0.25],
		unit: 'ratio',
		meaning: 'Lowest, highest and step of the pattern scale a player may choose',
		bounds: positive,
		rationale: 'From half to double the configured pitch keeps every pattern recognisable.'
	},

	seedBand: {
		value: [1, 64, 1],
		unit: 'seed',
		meaning: 'Lowest, highest and step of the variation seed offered on the page',
		bounds: { min: 0 },
		rationale: 'A short range is enough to compare variations.'
	},
	plateSizeM: {
		value: [2, 2],
		unit: 'm',
		meaning: 'Width and height of one sample plate',
		bounds: positive,
		rationale: 'Large enough for several periods of every pattern.'
	},
	plateThicknessM: {
		value: 0.12,
		unit: 'm',
		meaning: 'Thickness of a sample plate behind its face',
		bounds: positive,
		rationale: 'Reads as a physical slab in iso.'
	},
	plateGapM: {
		value: [0.9, 2.6],
		unit: 'm',
		meaning: 'Gap between plates in a row and depth step between rows',
		bounds: positive,
		rationale: 'Keeps the cast shadow of one plate off the next.'
	},
	plateStandM: {
		value: [0.35, 0.5, 0.6],
		unit: 'm',
		meaning: 'Height of the front stand, extra height of each further tier and stand depth',
		bounds: positive,
		rationale: 'Each tier rises so the back plates show above the front ones.'
	},
	plateColumns: {
		value: 3,
		unit: 'plates',
		meaning: 'Plates per row of the sample board',
		bounds: { min: 1 },
		rationale: 'Three columns keep each plate large on a wide canvas.'
	},
	bodySizeM: {
		value: [8, 6, 4.6, 7],
		unit: 'm',
		meaning: 'Width, depth, eaves height and ridge height of the sample body',
		bounds: positive,
		rationale: 'A small two-storey house with a gable.'
	},
	bodyWallM: {
		value: 0.3,
		unit: 'm',
		meaning: 'Wall thickness of the sample body',
		bounds: positive,
		rationale: 'A plain solid wall; the opening reveal shows it.'
	},
	bodyEaveM: {
		value: 0.35,
		unit: 'm',
		meaning: 'Roof overhang beyond the walls',
		bounds: positive,
		rationale: 'A visible eave line separates roof and wall.'
	},
	bodyDoorM: {
		value: [1.2, 2.3, 1.6],
		unit: 'm',
		meaning: 'Door width, height and offset of its left jamb from the front wall corner',
		bounds: { min: 0 },
		rationale: 'One storey-high opening on the front.'
	},
	bodyWindowM: {
		value: [1.8, 1.4, 4.6, 0.9],
		unit: 'm',
		meaning: 'Window width, height, offset from the wall corner and sill height',
		bounds: { min: 0 },
		rationale: 'One wide window beside the door, repeated on the side wall.'
	},
	bodyOpeningInsetM: {
		value: 0.15,
		unit: 'm',
		meaning: 'Depth of the glazing behind the outer wall face',
		bounds: positive,
		rationale: 'Half the wall, so the reveal reads on two sides.'
	},
	bodyGlazingM: {
		value: 0.04,
		unit: 'm',
		meaning: 'Thickness of the dark backing behind the glazing in an opening',
		bounds: positive,
		rationale: 'Thin enough to sit inside the reveal.'
	},

	bodyGroundM: {
		value: [3, 0.12],
		unit: 'm',
		meaning: 'Ground margin around the body and ground slab thickness',
		bounds: positive,
		rationale: 'Shows the ground contact and the cast shadow.'
	}
});

/** Defaults consumed by the surfaces page. */
export const specimenSettings = settingValues(settings);
