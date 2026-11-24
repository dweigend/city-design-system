import { defineSettings, settingValues } from '../setting';

/** Stroke and fill settings of the house drawing, in CSS pixels and unitless shares. */
export const settings = defineSettings({
	bodyStrokePx: {
		value: 1.1,
		unit: 'px',
		meaning: 'Line width of house walls, masses and roof edges',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-6'
	},
	detailStrokePx: {
		value: 0.6,
		unit: 'px',
		meaning: 'Line width of floor edges, openings, ground plates and galleries',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-6'
	},
	bodyStrokeOpacity: {
		value: 0.9,
		unit: 'ratio',
		meaning: 'Opacity of the main house lines',
		bounds: { min: 0, max: 1 },
		principle: 'FORM-6'
	},
	detailStrokeOpacity: {
		value: 0.55,
		unit: 'ratio',
		meaning: 'Opacity of the secondary house lines',
		bounds: { min: 0, max: 1 },
		principle: 'FORM-6'
	},
	hiddenLineShare: {
		value: 0.25,
		unit: 'ratio',
		meaning: 'Share of a line kept where a body in front hides it',
		bounds: { min: 0, max: 1 },
		principle: 'COLOR-5'
	},
	pencilHatch: {
		value: 0.8,
		unit: 'ratio',
		meaning: 'Strength of pencil hatching on the shaded faces of the pencil drawing',
		bounds: { min: 0, max: 1 },
		principle: 'COLOR-5'
	},
	sheetGapM: {
		value: 8,
		unit: 'm',
		meaning: 'Gap between houses laid side by side on a comparison sheet',
		bounds: { min: 0 },
		rationale: 'Two storeys of clear ground keep neighbouring houses apart at sheet zoom.'
	},
	cladOffsetM: {
		value: 0.02,
		unit: 'm',
		meaning: 'Distance a cladding face stands proud of the house face it covers',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps a flat cladding slab from depth fighting with the body face behind it.'
	},
	cladThicknessM: {
		value: 0.03,
		unit: 'm',
		meaning: 'Backing thickness of a cladding patch on a house face',
		bounds: { exclusiveMin: 0 },
		principle: 'MAT-5'
	},
	blockTriangleBudget: {
		value: 240000,
		unit: 'triangles',
		meaning:
			'Cladding triangles of one block of houses at the relief level, shared among its faces by area',
		bounds: { min: 0 },
		principle: 'MAT-5',
		rationale:
			'About a quarter of a frame budget of one million triangles; the relief coarsens or turns flat beyond it.'
	},
	veilAlpha: {
		value: 0.35,
		unit: 'ratio',
		meaning: 'Fill opacity of the see-through house drawing',
		bounds: { min: 0, max: 1 },
		principle: 'COLOR-6'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
