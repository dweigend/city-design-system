import { defineSettings, settingValues } from '../setting';

/** Numeric settings of the fine cell space inside a parcel or bay. */
export const settings = defineSettings({
	refinementRounds: {
		value: 1,
		unit: 'count',
		meaning: 'Midpoint refinement rounds applied to every corner quad after the first split',
		bounds: { min: 0 },
		principle: 'GRID-1',
		rationale:
			'One round gives every corner quad an inner cell, so a court can stay open on any parcel shape.'
	},
	matchToleranceM: {
		value: 1e-6,
		unit: 'm',
		meaning:
			'Largest distance at which two cell corners or a corner and a parcel edge count as one',
		bounds: { exclusiveMin: 0 },
		rationale: 'Absorbs roundoff of midpoint arithmetic at parcel scale (under 1 km).'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
