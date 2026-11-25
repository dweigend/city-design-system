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
		meaning: 'Most triangles the library specimen with slabs, openings and ground may use',
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
	bodyBarM: {
		value: [12, 6, 3.1],
		unit: 'm',
		meaning: 'Width, depth and wall height of the lower library bar',
		bounds: positive,
		principle: 'CITY-1'
	},
	bodyPavilionM: {
		value: [6, 4.8, 3.8],
		unit: 'm',
		meaning: 'Width, depth and wall height of the upper reading room',
		bounds: positive,
		principle: 'CITY-1'
	},
	bodyPavilionOffsetM: {
		value: [4.2, 0],
		unit: 'm',
		meaning: 'Horizontal shift of the reading room from the lower bar center',
		rationale: 'Projects past the east wall and sets back from the long front and rear walls.'
	},
	bodyWallM: {
		value: 0.3,
		unit: 'm',
		meaning: 'Wall thickness of both library volumes',
		bounds: positive,
		rationale: 'The glazing recess shows the thickness of the board.'
	},
	bodySlabM: {
		value: [0.18, 0.28],
		unit: 'm',
		meaning: 'Plan overhang and thickness of the flat roof slabs and cantilever floor',
		bounds: positive,
		rationale: 'The slab edges separate the two volumes and define the cantilever.'
	},
	bodyBarFrontLightM: {
		value: [1.2, 0.8, 7.8, 2.25],
		unit: 'm',
		meaning: 'Left, bottom, right and top of the lower bar strip window',
		bounds: positive,
		rationale: 'A recessed horizontal opening lights the long public room.'
	},
	bodyBarEntranceM: {
		value: [9, 0, 10.8, 2.5],
		unit: 'm',
		meaning: 'Left, bottom, right and top of the entrance in the lower bar',
		bounds: { min: 0 },
		rationale: 'The entrance reaches the ground under the upper reading room.'
	},
	bodyPavilionFrontLightM: {
		value: [0.6, 1.1, 4.8, 2.9],
		unit: 'm',
		meaning: 'Left, bottom, right and top of the upper front picture window',
		bounds: positive,
		rationale: 'A broad recessed opening marks the reading room.'
	},
	bodyPavilionEndLightM: {
		value: [0.6, 1.1, 3.6, 2.9],
		unit: 'm',
		meaning: 'Left, bottom, right and top of the upper east picture window',
		bounds: positive,
		rationale: 'The same sill and head heights carry the opening around the cantilever.'
	},
	bodyPatternBudgetShare: {
		value: 0.7,
		unit: 'ratio',
		meaning: 'Share of each wall budget used to estimate a common print scale',
		bounds: { exclusiveMin: 0, max: 1 },
		rationale:
			'Leaves triangles for the closed wall and for differences between estimated and fitted marks.'
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
