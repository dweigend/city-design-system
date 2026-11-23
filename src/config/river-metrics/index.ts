import { defineSettings, settingValues } from '../setting';

/** Numeric settings and their provenance. */
export const settings = defineSettings({
	wavelengthHeadingCrossingToleranceRatio: {
		value: 1e-12,
		unit: 'ratio',
		meaning: 'Maximum absolute cross-axis component treated as parallel',
		bounds: { min: 0 },
		rationale: 'Keeps floating-point noise near an axis heading from counting as a crossing.'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
