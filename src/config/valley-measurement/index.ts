import { defineSettings, settingValues } from '../setting';

/** Numeric settings and their provenance. */
export const settings = defineSettings({
	measurementLocalWindowM: {
		value: 2_000,
		unit: 'm',
		meaning: 'Side of the centered local course measurement square',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementRegionalWindowM: {
		value: 8_000,
		unit: 'm',
		meaning: 'Side of the centered regional course measurement square',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementCornerBearingsDeg: {
		value: [0, 15, 30, 45, 60, 75, 90],
		unit: 'deg',
		meaning: 'Bearings sampled near the measurement square corners',
		bounds: { min: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementReliefCoreM: {
		value: 1_000,
		unit: 'm',
		meaning: 'Side of the square used to measure core relief',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementFieldSpacingM: {
		value: 12.5,
		unit: 'm',
		meaning: 'North-first measurement raster spacing',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementStationOffsetM: {
		value: 125,
		unit: 'm',
		meaning: 'Distance along the reach to the first cross section',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementStationTangentHalfLengthM: {
		value: 60,
		unit: 'm',
		meaning: 'Half-length of the chord used to orient each cross section',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementBoxFractions: {
		value: [0, 0.5, 1],
		unit: 'ratio',
		meaning: 'Relative positions sampled across a box axis',
		bounds: { min: 0, max: 1 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementGaussianTruncateSigma: {
		value: 4,
		unit: 'sigma',
		meaning: 'Gaussian kernel cutoff measured in standard deviations',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementLandSlopeClassLimits: {
		value: [0.02, 0.05, 0.15],
		unit: 'rise/run',
		meaning: 'Upper slopes for the three finite land slope classes',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementSurfaceSpacingM: {
		value: 30,
		unit: 'm',
		meaning: 'Spacing of the resampled terrain used for surface statistics',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementSmoothingSigmaM: {
		value: 30,
		unit: 'm',
		meaning: 'Gaussian standard deviation for water-filled terrain',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementProfileSpacingM: {
		value: 250,
		unit: 'm',
		meaning: 'Distance along the course between cross sections',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementProfileHalfLengthM: {
		value: 1_000,
		unit: 'm',
		meaning: 'Distance sampled to each side of a cross section',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementStepMinimumSlope: {
		value: 0.05,
		unit: 'rise/run',
		meaning: 'Minimum slope of a terrace step candidate',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	},
	measurementStepMinimumGainM: {
		value: 3,
		unit: 'm',
		meaning: 'Minimum gain of a terrace step candidate',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Keeps the registered method comparable across measured rivers and generated valleys.'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
