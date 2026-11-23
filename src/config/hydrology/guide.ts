import type { Setting } from '../setting';

export const guide = {
	guideBankfullWidthBandM: {
		value: [350, 430],
		unit: 'm',
		meaning: 'Seeded bankfull width of the ancestral guide',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	guideWavelengthToWidthBandRatio: {
		value: [21.3, 24],
		unit: 'ratio',
		meaning: 'Seeded meander wavelength in bankfull widths',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	guidePhaseOffsetBandRad: {
		value: [-0.06, 0.06],
		unit: 'rad',
		meaning: 'Seeded perturbation around the chosen course phase',
		principle: 'CITY-11'
	},
	guideWindowPhaseBandRad: {
		value: [-Math.PI, Math.PI],
		unit: 'rad',
		meaning: 'Seeded phase of the meander at the window',
		principle: 'CITY-11'
	},
	valleyAxisTiltBandRad: {
		value: [-0.052, 0.052],
		unit: 'rad',
		meaning: 'Seeded rotation of the valley axis relative to the guide chord',
		principle: 'CITY-11'
	},
	guideWindowAcrossBandRatio: {
		value: [-1, 1],
		unit: 'ratio',
		meaning: 'Normalized lateral position of the guide in the window',
		principle: 'CITY-11'
	},
	headingQuadratureSampleCount: {
		value: 32,
		unit: 'count',
		meaning: 'Midpoint samples used to estimate full-wave sinuosity',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Balances the full-wave integration error against the cost of solving the heading amplitude.'
	},
	nominalHeadingAmplitudeBandRad: {
		value: [0.71, 0.79],
		unit: 'rad',
		meaning: 'Seeded nominal amplitude of the meander heading',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	headingAmplitudeSearchMaxRad: {
		value: 1.2,
		unit: 'rad',
		meaning: 'Upper bound of the heading amplitude bisection',
		bounds: { exclusiveMin: 0 },
		rationale: 'Brackets the supported sinuosity range without reversing downstream progress.'
	},
	headingAmplitudeSearchIterations: {
		value: 28,
		unit: 'count',
		meaning: 'Number of bisection steps for the heading amplitude',
		bounds: { exclusiveMin: 0 },
		rationale: 'Controls heading amplitude convergence at fixed cost.'
	},
	guidePointSpacingM: {
		value: 6.25,
		unit: 'm',
		meaning: 'Integrating step along the guide centerline',
		bounds: { exclusiveMin: 0 },
		rationale: 'Resolves the ancestral course before routing onto the coarser catchment raster.'
	},
	guideRegionalCoverageM: {
		value: 13_000,
		unit: 'm',
		meaning: 'Square side whose corner defines the extra guide extent',
		bounds: { exclusiveMin: 0 },
		rationale: 'Extends both ends of the ancestral guide beyond the solve square after placement.'
	},
	guideWetToBankfullWidthRatio: {
		value: 0.94,
		unit: 'ratio',
		meaning: 'Wet width as a fraction of bankfull width for the ancestral channel',
		bounds: { exclusiveMin: 0, max: 1 },
		principle: 'CITY-11'
	},
	guidePlacementChordReachM: {
		value: 1000,
		unit: 'm',
		meaning: 'Half-length of the guide placement chord',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	guideNearBankOffsetBandM: {
		value: [185, 285],
		unit: 'm',
		meaning: 'Seeded offset of the guide toward the closer bank',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	guideFarBankOffsetBandM: {
		value: [375, 430],
		unit: 'm',
		meaning: 'Seeded offset of the guide toward the farther bank',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	guideHeadingAlignmentBandRatio: {
		value: [0.22, 0.62],
		unit: 'ratio',
		meaning: 'Fraction of the guide heading aligned to the window bearing',
		bounds: { min: 0, max: 1 },
		principle: 'CITY-11'
	},
	openBankPositiveSideProbability: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Chance that the wider floodplain lies on the positive side',
		bounds: { min: 0, max: 1 },
		principle: 'CITY-11'
	},
	valleyFrameBearingRad: {
		value: -Math.PI / 2,
		unit: 'rad',
		meaning: 'Bearing of the course in the public valley frame',
		principle: 'CITY-11'
	},
	guideProjectionLeafSegments: {
		value: 8,
		unit: 'count',
		meaning: 'Maximum segment count in a guide projection tree leaf',
		bounds: { exclusiveMin: 0 },
		rationale: 'Balances tree traversal against exact distance checks inside each leaf.'
	}
} as const satisfies Readonly<Record<string, Setting>>;
