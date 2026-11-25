import { defineSettings, settingValues } from '../setting';

/** Settings of placing a house on a city parcel. */
export const settings = defineSettings({
	publicStoreyHeightM: {
		value: 4.2,
		unit: 'm',
		meaning: 'Clearer vertical proportion for the taller hall in a mixed-use pair of storeys',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-1'
	},
	contactToleranceM: {
		value: 0.001,
		unit: 'm',
		meaning:
			'Largest distance of a parcel edge midpoint from a court or lane boundary that still counts as touching it',
		bounds: { exclusiveMin: 0 },
		rationale: 'Parcel and court rings share edges to about 1e-7 m; a millimetre is far above that.'
	},
	groundSampleSpacingM: {
		value: 4,
		unit: 'm',
		meaning: 'Maximum sample spacing along the edges of a terrain-contact triangle',
		bounds: { exclusiveMin: 0 },
		rationale: 'Samples inside each parcel cell as well as its boundary to seat bases on relief.'
	},
	groundToleranceM: {
		value: 0.15,
		unit: 'm',
		meaning: 'Allowed vertical difference between house access or a foundation and sampled terrain',
		bounds: { min: 0 },
		rationale: 'At most one kerb height before a vertical gap needs a modeled connection.'
	},
	cornerSineRatio: {
		value: 0.26,
		unit: 'ratio',
		meaning:
			'Sine of the smallest turn between the frontage and another lane edge that makes a parcel a block corner (about 15°)',
		bounds: { min: 0, max: 1 },
		principle: 'FORM-2'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
