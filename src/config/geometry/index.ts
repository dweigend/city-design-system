import { defineSettings, settingValues } from '../setting';

/** Geometric predicates shared by metric plan and surface rings. */
export const settings = defineSettings({
	convexTurnToleranceM2: {
		value: 1e-6,
		unit: 'm²',
		meaning: 'Maximum rounding error in the cross product of two consecutive plan edges',
		bounds: { exclusiveMin: 0 },
		rationale: 'Accepts near-collinearity after a change from world coordinates to surface axes.'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
