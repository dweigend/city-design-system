import { defineSettings, settingValues } from '../setting';

/** Settings of placing a house on a city parcel. */
export const settings = defineSettings({
	contactToleranceM: {
		value: 0.001,
		unit: 'm',
		meaning:
			'Largest distance of a parcel edge midpoint from a court or lane boundary that still counts as touching it',
		bounds: { exclusiveMin: 0 },
		rationale: 'Parcel and court rings share edges to about 1e-7 m; a millimetre is far above that.'
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
