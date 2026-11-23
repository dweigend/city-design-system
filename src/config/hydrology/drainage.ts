import type { Setting } from '../setting';

export const drainage = {
	catchmentCellSizeM: {
		value: 75,
		unit: 'm',
		meaning: 'Spacing of the triangulated drainage solve grid',
		bounds: { exclusiveMin: 0 },
		rationale: 'Resolves drainage paths while bounding the number of cells in the solve.'
	},
	catchmentGridSideNodes: {
		value: 161,
		unit: 'count',
		meaning: 'Number of nodes along one side of the catchment grid',
		bounds: { exclusiveMin: 2 },
		rationale: 'An odd side count centers the grid on a node and fits the regional solve.'
	},
	catchmentSlopeCapMmPerM: {
		value: 500,
		unit: 'mm/m',
		meaning: 'Maximum height rise in millimeters per meter along a solve grid axis',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	minimumLakeAreaM2: {
		value: 20_000,
		unit: 'm\u00b2',
		meaning: 'Minimum inundated area for a depression retained as a lake',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	minimumLakeDepthMm: {
		value: 1000,
		unit: 'mm',
		meaning: 'Minimum depth for a depression retained as a lake',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	nodeAreaBalanceRelativeToleranceRatio: {
		value: 1e-9,
		unit: 'ratio',
		meaning: 'Maximum per-node relative contributing-area balance error',
		bounds: { min: 0 },
		rationale: 'Allows for summation roundoff when checking contributing area.'
	},
	nodeAreaBalanceScaleFloorM2: {
		value: 1,
		unit: 'm\u00b2',
		meaning: 'Minimum reference area when scaling the node balance tolerance',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the balance tolerance meaningful on nearly empty nodes.'
	},
	tributaryAreaThresholdM2: {
		value: 500_000,
		unit: 'm\u00b2',
		meaning: 'Contributing area required to initiate a tributary at full relief',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	lowReliefTributaryAreaIncreaseM2: {
		value: 27_500_000,
		unit: 'm\u00b2',
		meaning: 'Increase in tributary initiation area at zero relief',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	tributaryAreaReliefExponent: {
		value: 4,
		unit: 'ratio',
		meaning: 'Exponent controlling how quickly the tributary threshold falls with relief',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	unitRunoffYieldM3PerSKm2: {
		value: 0.02,
		unit: 'm\u00b3/s/km\u00b2',
		meaning: 'Discharge produced by a square kilometer at unit runoff',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	channelWidthCoefficientM: {
		value: 31,
		unit: 'm',
		meaning: 'Channel width at a discharge of one cubic meter per second',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	channelWidthExponent: {
		value: 0.34,
		unit: 'ratio',
		meaning: 'Exponent of discharge in the width law',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	defaultImportedLowlandAreaKm2: {
		value: 3000,
		unit: 'km\u00b2',
		meaning: 'Imported lowland area at the reference ancestral width',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	importedAreaReferenceWidthM: {
		value: 370,
		unit: 'm',
		meaning: 'Ancestral wet width associated with the default upstream area',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	importedAreaReliefDivisor: {
		value: 150,
		unit: 'ratio',
		meaning: 'Divisor of the lowland upstream area retained at full relief',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	importedAreaReliefExponent: {
		value: 2,
		unit: 'ratio',
		meaning: 'Exponent controlling the transition from lowland to headwater imported area',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	channelDepthCoefficientM: {
		value: 0.35,
		unit: 'm',
		meaning: 'Channel center depth at one cubic meter per second',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	channelDepthExponent: {
		value: 0.35,
		unit: 'ratio',
		meaning: 'Exponent of discharge in the channel depth law',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	},
	tributaryBendTrimRatio: {
		value: 0.25,
		unit: 'ratio',
		meaning: 'Fraction of adjacent reaches used to enter and exit a rounded bend',
		bounds: { min: 0, max: 1 },
		principle: 'CITY-11'
	},
	tributaryBendElevationToleranceM: {
		value: 1,
		unit: 'm',
		meaning: 'Maximum terrain-to-water elevation difference at the rounded bend',
		bounds: { min: 0 },
		rationale:
			'Rejects rounding when a shortcut crosses high ground or drops too far below the channel.'
	}
} as const satisfies Readonly<Record<string, Setting>>;
