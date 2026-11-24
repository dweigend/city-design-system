import { defineSettings, settingValues } from '../setting';

/** Opening sandbox brush and framing values. */
export const settings = defineSettings({
	sandboxBrushWidthM: {
		value: 28,
		unit: 'm',
		meaning: 'Width input of a painted house',
		bounds: { exclusiveMin: 0 },
		rationale: 'Uses the Architecture Town specimen width.'
	},
	sandboxBrushHeightM: {
		value: 14,
		unit: 'm',
		meaning: 'Height input of a painted house',
		bounds: { exclusiveMin: 0 },
		rationale: 'Uses the Architecture Town specimen height.'
	},
	sandboxBrushComplexity: {
		value: 0.6,
		unit: 'ratio',
		meaning: 'Complexity input of a painted house',
		bounds: { min: 0, max: 1 },
		rationale: 'Uses the Architecture Town specimen complexity.'
	},
	sandboxViewContextFill: {
		value: 0.25,
		unit: 'ratio',
		meaning: 'Fraction of the opening view used by the subject block',
		bounds: { min: 0, max: 1 },
		rationale: 'Keeps adjacent parcels visible for a multi-parcel stroke.'
	},
	sandboxClickSlopPx: {
		value: 6,
		unit: 'px',
		meaning: 'Pointer travel below which a press and release count as a click, not a drag',
		bounds: { min: 0 },
		rationale: 'Absorbs hand tremor on touch and trackpads without eating short drags.'
	},
	sandboxSpecimenSeed: {
		value: 7,
		unit: 'seed',
		meaning: 'Seed of the house drawn as a style specimen',
		bounds: { min: 0 },
		rationale: 'A fixed seed keeps the specimens identical between visits.'
	},
	sandboxSpecimenMarginRatio: {
		value: 0.06,
		unit: 'ratio',
		meaning: 'Margin around a style specimen as a share of its larger side',
		bounds: { min: 0 },
		rationale: 'Keeps the drawing clear of the swatch border.'
	},
	sandboxSpecimenDecimals: {
		value: 2,
		unit: 'digits',
		meaning: 'Decimals kept in the coordinates of a style specimen drawing',
		bounds: { min: 0 },
		rationale: 'Centimetre precision is far below a pixel at specimen size and keeps the SVG short.'
	}
});

/** Frozen sandbox brush settings. */
export const defaults = settingValues(settings);
