import { defineSettings, joinSettings, settingValues } from '../setting';

const carrier = defineSettings({
	targetAreaBaseRatio: {
		value: 0.554,
		unit: 'ratio',
		meaning: 'Linear built-area contribution per nominal kilometer',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	targetAreaGrowthRatio: {
		value: 0.105,
		unit: 'ratio',
		meaning: 'Additional built-area contribution per squared nominal kilometer',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	coarseCellSizeM: {
		value: 60,
		unit: 'm',
		meaning: 'Equivalent square side of a typical plan cell',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	bankSetbackM: {
		value: 3,
		unit: 'm',
		meaning: 'Minimum clearance from water for occupied ground',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	groundSampleStepM: {
		value: 8,
		unit: 'm',
		meaning: 'Maximum spacing between occupied-ground probes',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	maximumCellRiseM: {
		value: 16,
		unit: 'm',
		meaning: 'Maximum sampled elevation range within one buildable cell',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	minimumRegionAreaM2: {
		value: 360_000,
		unit: 'm²',
		meaning: 'Minimum eligible area for an independent growth region',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	windowSampleStepM: {
		value: 12,
		unit: 'm',
		meaning: 'Target sample spacing for an alternate terrain window',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	windowMaxIntervals: {
		value: 128,
		unit: 'count',
		meaning: 'Maximum sample intervals along either window axis',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	crossingMaxLengthM: {
		value: 320,
		unit: 'm',
		meaning: 'Longest eligible edge path between crossing heads',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	crossingSpacingM: {
		value: 105,
		unit: 'm',
		meaning: 'Minimum distance between candidate crossing midpoints',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	crossingProbeStepM: {
		value: 5,
		unit: 'm',
		meaning: 'Maximum spacing between wetness probes on a crossing chord or routed edge',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	minimumPathStraightnessRatio: {
		value: 0.58,
		unit: 'ratio',
		meaning: 'Minimum chord-to-path ratio for a crossing candidate',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	straightSpanThresholdRatio: {
		value: 0.94,
		unit: 'ratio',
		meaning: 'A bridge uses its chord below this chord-to-path ratio',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	coreDistanceWeightRatio: {
		value: 0.22,
		unit: 'ratio',
		meaning: 'Distance from the growth center added to the path cost, in meters per meter',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	selectionIncrementKm2: {
		value: 1.25,
		unit: 'km²',
		meaning: 'Selected crossings added once for every started increment of built area',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	selectionBaseCount: {
		value: 1,
		unit: 'count',
		meaning: 'Selected crossings allowed in addition to the area-based count',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	centerStationRangeM: {
		value: 860,
		unit: 'm',
		meaning: 'Maximum seeded station offset along the valley from the city frame origin',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	centerSearchAlongM: {
		value: 520,
		unit: 'm',
		meaning: 'Maximum search distance along the valley for the crossing center',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	centerSearchAlongStepM: {
		value: 65,
		unit: 'm',
		meaning: 'Spacing between samples along the valley in the search for the crossing center',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	centerSearchAcrossM: {
		value: 1500,
		unit: 'm',
		meaning: 'Maximum search distance across the valley for the crossing center',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	centerSearchAcrossStepM: {
		value: 12,
		unit: 'm',
		meaning: 'Spacing between samples across the valley in the search for the crossing center',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	centerWidthWeightRatio: {
		value: 3,
		unit: 'ratio',
		meaning: 'Width contribution to the crossing-center cost, in meters per meter',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	centerAcrossWeightRatio: {
		value: 0.35,
		unit: 'ratio',
		meaning: 'Across-valley offset contribution to the crossing-center cost, in meters per meter',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	centerFallbackShiftM: {
		value: 140,
		unit: 'm',
		meaning: 'Maximum seeded across-valley shift when the center search finds no river',
		rationale: 'Keeps the established city site and crossing defaults.'
	},
	primaryPathWeightRatio: {
		value: 0.45,
		unit: 'ratio',
		meaning: 'Path length contribution to the primary-crossing cost, in meters per meter',
		rationale: 'Keeps the established city site and crossing defaults.'
	}
});

function setting(value: number, unit: string, meaning: string) {
	return {
		value,
		unit,
		meaning,
		rationale: 'Preserves the established city site dimensions and sampling.'
	};
}

const dimensions = defineSettings({
	citySizeDefaultM: setting(1800, 'm', 'Initial city extent'),
	citySizeMinimumM: setting(600, 'm', 'Smallest selectable city extent'),
	citySizeMaximumM: setting(7000, 'm', 'Largest selectable city extent and length of the carrier'),
	citySizeStepM: setting(200, 'm', 'Distance between selectable city extents'),
	cityDefaultSeed: setting(1201, 'seed', 'Seed of the initial city and valley'),
	cityCarrierHalfWidthM: setting(
		1900,
		'm',
		'Distance the carrier extends across the valley to either side'
	),
	citySiteBearingRad: setting(-Math.PI / 2, 'rad', 'Default bearing of the city frame'),
	trunkSectionSearchM: setting(
		3500,
		'm',
		'Distance past a trunk segment included in its section lookup'
	),
	trunkSectionSizeM: setting(250, 'm', 'Bucket size of the trunk segment lookup'),
	emptyCityWindowLengthM: setting(1200, 'm', 'Length of the terrain window for an empty plan'),
	emptyCityWindowWidthM: setting(900, 'm', 'Width of the terrain window for an empty plan'),
	cityWindowLengthScaleRatio: setting(
		1.12,
		'ratio',
		'Length multiplier for framing the occupied plan'
	),
	cityWindowWidthScaleRatio: setting(
		1.2,
		'ratio',
		'Width multiplier for framing the occupied plan'
	),
	cityWindowLengthPaddingM: setting(320, 'm', 'Extra length around the occupied plan'),
	cityWindowWidthPaddingM: setting(370, 'm', 'Extra width around the occupied plan')
});

export const settings = joinSettings(carrier, dimensions);
export const citySiteConfig = settingValues(carrier);
export const citySiteDimensions = settingValues(dimensions);
