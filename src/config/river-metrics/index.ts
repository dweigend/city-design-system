import { defineSettings, settingValues } from '../setting';

/** Numeric settings and their provenance. */
export const settings = defineSettings({
	maximumCrossProfileSampleCount: {
		value: 1_000_000,
		unit: 'count',
		meaning: 'Maximum number of stations or total sample probes in the cross-profile scan',
		bounds: { min: 1 },
		rationale: 'Bounds synchronous measurement work and the memory used by profiles and results.'
	},
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
