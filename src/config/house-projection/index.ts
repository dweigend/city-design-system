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
