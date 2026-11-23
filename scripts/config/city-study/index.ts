import { defineSettings, settingValues } from '../../../src/config/setting';

/** Acceptance settings for the city study. */
export const settings = defineSettings({
	footprintCompactnessRange: {
		value: [0.45, 0.75],
		unit: 'ratio',
		meaning: 'Accepted range of the median built-footprint area divided by its convex hull area',
		bounds: { min: 0, max: 1 },
		rationale:
			'The river-town references measure about 0.73. The narrower river yields more compact towns, so the upper bound replaces the earlier estimate of 0.65.'
	}
});

/** Values used by the city study acceptance checks. */
export const { footprintCompactnessRange } = settingValues(settings);
