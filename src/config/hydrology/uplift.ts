import type { Setting } from '../setting';

export const uplift = {
	massifCenterJitterBandM: {
		value: [-660, 660],
		unit: 'm',
		meaning: 'Seeded center displacement on either axis of the massif grid',
		principle: 'CITY-11'
	},
	massifRadiusBandM: {
		value: [620, 1450],
		unit: 'm',
		meaning: 'Seeded radius on either principal axis of a massif',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	massifAmplitudeBandRatio: {
		value: [0.25, 0.85],
		unit: 'ratio',
		meaning: 'Seeded fraction of peak height assigned to a massif',
		bounds: { min: 0, max: 1 },
		principle: 'CITY-11'
	},
	maximumPeakHeightM: {
		value: 400,
		unit: 'm',
		meaning: 'Nominal peak-height scale at full relief',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	peakHeightReliefExponent: {
		value: 1.3,
		unit: 'ratio',
		meaning: 'Exponent mapping relief to nominal peak height',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	massifGridSpacingM: {
		value: 1750,
		unit: 'm',
		meaning: 'Distance between unjittered centers of adjacent massifs',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	massifGridSideCount: {
		value: 9,
		unit: 'count',
		meaning: 'Number of seeded massif centers along each grid axis',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	massifGateStartM: {
		value: 510,
		unit: 'm',
		meaning: 'Distance from the trough where uplift starts at zero relief',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	massifGateStartReductionM: {
		value: 280,
		unit: 'm',
		meaning: 'Inward movement of the uplift gate at full relief',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	massifGateRiseRunM: {
		value: 1030,
		unit: 'm',
		meaning: 'Lateral run from first uplift to full uplift',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	massifSearchRadiusCells: {
		value: 2,
		unit: 'count',
		meaning: 'Maximum offset from the query cell to contributing massif centers',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Limits sampling to nearby massif centers. Keep wide or heavily jittered massifs inside this search radius.'
	},
	massifSupportRadiusSquaredRatio: {
		value: 4,
		unit: 'ratio',
		meaning: 'Squared normalized radius where a massif stops contributing',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	massifFalloffExponent: {
		value: 4,
		unit: 'ratio',
		meaning: 'Exponent shaping the falloff from a massif center',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	}
} as const satisfies Readonly<Record<string, Setting>>;
