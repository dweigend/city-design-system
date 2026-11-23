import type { Setting } from '../setting';

export const regional = {
	regionalChordHalfSpanM: {
		value: 420,
		unit: 'm',
		meaning: 'Distance to either side of a station used to smooth the regional course',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	centralTerraceRadiusM: {
		value: 1420,
		unit: 'm',
		meaning: 'Distance from the central field before switching toward the regional terrace profile',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	regionalTerraceBlendRunM: {
		value: 1100,
		unit: 'm',
		meaning: 'Downstream transition length from the local to the regional terrace edge',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	regionalShoulderBlendRunM: {
		value: 950,
		unit: 'm',
		meaning: 'Radial transition length for the regional shoulder beyond the central field',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	regionalFlankStartM: {
		value: 650,
		unit: 'm',
		meaning: 'Lateral distance where the regional shoulder starts rising',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	regionalFlankRiseRunM: {
		value: 1550,
		unit: 'm',
		meaning: 'Lateral run over which the regional shoulder rises',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	terraceScallopLongAmplitudeM: {
		value: 49,
		unit: 'm',
		meaning: 'Amplitude of the longer lateral terrace scallop',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	terraceScallopLongScaleM: {
		value: 337,
		unit: 'm',
		meaning: 'Station distance per radian of the longer terrace scallop',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	terraceScallopShortAmplitudeM: {
		value: 14,
		unit: 'm',
		meaning: 'Amplitude of the shorter lateral terrace scallop',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	terraceScallopShortScaleM: {
		value: 126,
		unit: 'm',
		meaning: 'Station distance per radian of the shorter terrace scallop',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	regionalShoulderBaseRiseM: {
		value: 6,
		unit: 'm',
		meaning: 'Mean height of the regional shoulder at full blend',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	regionalShoulderAmplitudeM: {
		value: 3,
		unit: 'm',
		meaning: 'Variation in shoulder height along the course',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	regionalShoulderWaveScaleM: {
		value: 700,
		unit: 'm',
		meaning: 'Station distance per radian of shoulder height variation',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	troughProjectionDistanceCapMm: {
		value: 2_000_000,
		unit: 'mm',
		meaning: 'Distance cap when projecting terrain onto the guide trough',
		bounds: { exclusiveMin: 0 },
		rationale: 'Caps the projection search after leaving the terrain influenced by the trough.'
	},
	foothillFullGainDistanceM: {
		value: 240,
		unit: 'm',
		meaning: 'Distance from the trough at which foothill height reaches full gain at zero relief',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	foothillGainDistanceReductionM: {
		value: 120,
		unit: 'm',
		meaning: 'Amount by which full foothill gain moves inward at maximum relief',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	sideValleyRiseSlopeRatio: {
		value: 0.0014,
		unit: 'rise/run',
		meaning: 'Extra lateral rise per unit relief beyond the trough',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	}
} as const satisfies Readonly<Record<string, Setting>>;
