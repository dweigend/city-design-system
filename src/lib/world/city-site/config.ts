/** Terrain sampling and plan limits for city sites. */
export const citySiteConfig = Object.freeze({
	coarseCellSizeM: 60, // Equivalent square side of a typical plan cell.
	bankSetbackM: 3, // Minimum clearance from water for occupied ground.
	groundSampleStepM: 8, // Maximum spacing between occupied-ground probes.
	maximumCellRiseM: 16, // Maximum sampled elevation range within one buildable cell.
	minimumRegionAreaM2: 360_000, // Minimum eligible area for an independent growth region.
	windowSampleStepM: 12, // Target sample spacing for an alternate terrain window.
	windowMaxIntervals: 128, // Maximum sample intervals along either window axis.
	// Longest eligible edge path between crossing heads.
	crossingMaxLengthM: 320,
	// Minimum distance between candidate crossing midpoints.
	crossingSpacingM: 105,
	// Maximum spacing between wetness probes on a crossing chord or routed edge.
	crossingProbeStepM: 5,
	// Minimum chord-to-path ratio for a crossing candidate.
	minimumPathStraightnessRatio: 0.58,
	// A bridge uses its chord below this chord-to-path ratio.
	straightSpanThresholdRatio: 0.94,
	// Distance from the growth center added to the path cost, in meters per meter.
	coreDistanceWeightRatio: 0.22,
	// Selected crossings added once for every started increment of built area.
	selectionIncrementKm2: 1.25,
	// Selected crossings allowed in addition to the area-based count.
	selectionBaseCount: 1,
	// Maximum seeded station offset along the valley from the city frame origin.
	centerStationRangeM: 860,
	// Maximum search distance along the valley for the crossing center.
	centerSearchAlongM: 520,
	// Spacing between samples along the valley in the search for the crossing center.
	centerSearchAlongStepM: 65,
	// Maximum search distance across the valley for the crossing center.
	centerSearchAcrossM: 1500,
	// Spacing between samples across the valley in the search for the crossing center.
	centerSearchAcrossStepM: 12,
	// Width contribution to the crossing-center cost, in meters per meter.
	centerWidthWeightRatio: 3,
	// Across-valley offset contribution to the crossing-center cost, in meters per meter.
	centerAcrossWeightRatio: 0.35,
	// Maximum seeded across-valley shift when the center search finds no river.
	centerFallbackShiftM: 140,
	// Path length contribution to the primary-crossing cost, in meters per meter.
	primaryPathWeightRatio: 0.45
});
