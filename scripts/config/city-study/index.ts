import { defineSettings, settingValues } from '../../../src/config/setting';

/** Acceptance settings for the city study. */
export const settings = defineSettings({
	detachedAreaEstimateM2: {
		value: [250, 900],
		unit: 'm²',
		meaning: 'Estimated observed area range for detached holdings.',
		rationale: 'Reference estimate for comparison, not a surveyed benchmark.'
	},
	perimeterAreaEstimateM2: {
		value: [120, 600],
		unit: 'm²',
		meaning: 'Estimated observed area range for perimeter holdings.',
		rationale: 'Reference estimate for comparison, not a surveyed benchmark.'
	},
	centerAreaEstimateM2: {
		value: [700, 3000],
		unit: 'm²',
		meaning: 'Estimated observed area range for center holdings.',
		rationale: 'Reference estimate for comparison, not a surveyed benchmark.'
	},
	parcelAreaAbsoluteM2: {
		value: 0.01,
		unit: 'm²',
		meaning: 'Absolute floor of the measured area-accounting tolerance.',
		rationale: 'R10a fixture acceptance threshold.'
	},
	parcelAreaRelativeRatio: {
		value: 1e-8,
		unit: 'ratio',
		meaning: 'Relative block area-accounting tolerance.',
		rationale: 'R10a fixture acceptance threshold.'
	},
	parcelFrontageM: {
		value: 3,
		unit: 'm',
		meaning: 'Minimum observed uninterrupted contact with a lane.',
		rationale: 'R10a fixture acceptance threshold.'
	},
	parcelTimingWarmups: {
		value: 2,
		unit: 'runs',
		meaning: 'Unrecorded warmup trials for parcel timing.',
		rationale: 'PB-3 default.'
	},
	parcelTimingRuns: {
		value: 5,
		unit: 'runs',
		meaning: 'Recorded trials per parcel timing case.',
		rationale: 'PB-3 default.'
	},
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
const values = settingValues(settings);
export const { footprintCompactnessRange, parcelTimingWarmups, parcelTimingRuns } = values;
export const parcelAreaEstimates = new Map<string, readonly [number, number]>([
	['detached', values.detachedAreaEstimateM2],
	['block', values.perimeterAreaEstimateM2],
	['center', values.centerAreaEstimateM2]
]);
export const parcelStudyLimits = Object.freeze({
	areaAbsoluteM2: values.parcelAreaAbsoluteM2,
	areaRelativeRatio: values.parcelAreaRelativeRatio,
	frontageM: values.parcelFrontageM
});
