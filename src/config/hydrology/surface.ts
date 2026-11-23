import type { Setting } from '../setting';

export const surface = {
	valleyRasterWindowM: {
		value: 2000,
		unit: 'm',
		meaning: 'Width of the centered public valley raster',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the sampled grid focused on the central terrain window.'
	},
	valleyRasterCellSizeM: {
		value: 12.5,
		unit: 'm',
		meaning: 'Node spacing in the public valley raster',
		bounds: { exclusiveMin: 0 },
		rationale: 'Samples the central terrain on a manageable raster.'
	},
	groundSlopeProbeHalfSpanM: {
		value: 2.5,
		unit: 'm',
		meaning: 'Distance sampled either side of a point to estimate local slope',
		bounds: { exclusiveMin: 0 },
		rationale: 'Provides a five-meter central difference and clamps it to the solve edge.'
	},
	channelCapChordErrorToleranceM: {
		value: 0.35,
		unit: 'm',
		meaning: 'Maximum chord error for the polygonal approximation of a channel cap',
		bounds: { exclusiveMin: 0 },
		rationale: 'Bounds the difference between the analytic bank distance and the channel outline.'
	},
	channelCapMinSegments: {
		value: 3,
		unit: 'count',
		meaning: 'Minimum number of chords in a semicircular channel cap',
		bounds: { min: 2 },
		rationale:
			'Keeps narrow semicircles represented by multiple chords even below the error tolerance.'
	},
	analyticBenchFadeReliefRatio: {
		value: 0.15,
		unit: 'ratio',
		meaning: 'Relief at which the ground sampler finishes blending out the analytic benches',
		bounds: { exclusiveMin: 0, max: 1 },
		principle: 'CITY-11'
	},
	trunkBankBlendRunM: {
		value: 36,
		unit: 'm',
		meaning: 'Horizontal run of the dry bank blend beside the trunk',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	secondaryBankBlendRunM: {
		value: 30,
		unit: 'm',
		meaning: 'Horizontal run of the dry bank blend beside other channels',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	waterBucketSizeM: {
		value: 160,
		unit: 'm',
		meaning: 'Width of a spatial bucket for shoreline and channel search',
		bounds: { exclusiveMin: 0 },
		rationale: 'Limits the number of segments considered per terrain read.'
	},
	waterBankDistanceCapM: {
		value: 160,
		unit: 'm',
		meaning: 'Maximum reported distance to water on dry land',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	waterBucketRowStride: {
		value: 1024,
		unit: 'count',
		meaning: 'Row stride of the spatial bucket key',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps neighboring bucket keys distinct across the supported regional window.'
	}
} as const satisfies Readonly<Record<string, Setting>>;
