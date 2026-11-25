import { defineSettings, settingValues } from '../../../src/config/setting';

/** Acceptance settings for the city study. */
export const settings = defineSettings({
	shoreStudySizeM: {
		value: 2600,
		unit: 'm',
		meaning: 'City extent used for the shoreline acceptance matrix.',
		rationale: 'The fixed R09c shoreline fixtures cover multiple reaches at this extent.'
	},
	shoreStudyBankToleranceM: {
		value: 8,
		unit: 'm',
		meaning: 'Maximum clearance error for samples along an aligned bank edge.',
		rationale: 'R09c measures fit against the setback independently of the morph tolerance.'
	},
	shoreStudyBandM: {
		value: 155,
		unit: 'm',
		meaning: 'Distance from the setback included in the cell quality measurements.',
		rationale: 'Fixed observation window for comparing shoreline grid quality.'
	},
	shoreStudyUnclippedTarget: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Minimum share of occupied shore cells that keep all their plan nodes.',
		bounds: { min: 0, max: 1 },
		rationale: 'R09c acceptance threshold, pooled across terrain cases for each plan.'
	},
	shoreStudyAlignedTarget: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Minimum share of bank edges aligned to the setback.',
		bounds: { min: 0, max: 1 },
		rationale: 'R09c acceptance threshold, pooled across terrain cases for each plan.'
	},
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
	mirrorProbeSpacingM: {
		value: 24,
		unit: 'm',
		meaning: 'Spacing of the footprint samples and their reflections',
		rationale: 'Samples the occupied halves of lowland plans at the scale of individual blocks.'
	},
	mirrorFootprintBucketM: {
		value: 90,
		unit: 'm',
		meaning: 'Side of the mirror study footprint lookup buckets',
		rationale: 'Keeps each footprint query local to neighboring plan cells.'
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
export const {
	footprintCompactnessRange,
	mirrorFootprintBucketM,
	mirrorProbeSpacingM,
	parcelTimingWarmups,
	parcelTimingRuns,
	shoreStudySizeM,
	shoreStudyBandM,
	shoreStudyBankToleranceM,
	shoreStudyUnclippedTarget,
	shoreStudyAlignedTarget
} = values;
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
