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
	}
});

/** Frozen sandbox brush settings. */
export const defaults = settingValues(settings);
