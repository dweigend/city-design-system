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
		meaning: 'Distance a thin printed sheet or roof tone stands proud of the face it covers',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the sheet from depth fighting with the body face behind it.'
	},
	cladSkinM: {
		value: 0.15,
		unit: 'm',
		meaning: 'Depth of the skin that recesses the openings of a body, and its reach past wall ends',
		bounds: { exclusiveMin: 0 },
		principle: 'MAT-12',
		rationale:
			'The dark back of an opening sits this far behind the face, so the hole reads recessed.'
	},
	blockTriangleBudget: {
		value: 30000,
		unit: 'triangles',
		meaning:
			'Cladding triangles of one block of houses at the near level, shared among its faces by area',
		bounds: { min: 0 },
		principle: 'MAT-5',
		rationale:
			'A fifth of the relief block (148,226), so a block of model houses costs a small fraction of the former picture.'
	},
	salientShareRatio: {
		value: 0.12,
		unit: 'ratio',
		meaning: 'Seeded share of ordinary houses granted detail besides the salient kinds',
		bounds: { min: 0, max: 1 },
		principle: 'MAT-15'
	},
	salientBlockCap: {
		value: 3,
		unit: 'houses',
		meaning: 'Most houses of one block granted detail, focus and selection aside',
		bounds: { min: 0 },
		principle: 'MAT-15'
	},
	salientViewCap: {
		value: 48,
		unit: 'houses',
		meaning: 'Most houses of one view granted detail, focus and selection aside',
		bounds: { min: 0 },
		principle: 'MAT-15'
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
