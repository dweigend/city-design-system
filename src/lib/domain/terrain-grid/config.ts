/** Defaults for shoreline alignment and its quality guard. */
export const shorelineMorphLimits = Object.freeze({
	// Distance from the setback at which the displacement field reaches zero.
	bandM: 155,
	// Minimum width across water for a bank to be eligible for alignment.
	minimumWaterWidthM: 24,
	// Maximum distance from the setback for an edge to count as aligned.
	bankToleranceM: 8,
	// Dry-side offset from the setback, leaving room for a chord to cut a curved bank.
	bankAllowanceM: 4.5,
	// Maximum total displacement of a bank node.
	maximumMoveM: 85,
	// Smallest retained area relative to the unmodified cell.
	minimumAreaRatio: 0.32,
	// Largest retained area relative to the unmodified cell.
	maximumAreaRatio: 2.2,
	// Smallest interior angle unless the original was already smaller.
	minimumAngleRad: Math.PI / 12,
	// Largest longest-to-shortest edge ratio unless the original was already larger.
	maximumEdgeRatio: 5,
	// Symmetric probe distance for estimating the direction to the bank.
	gradientProbeM: 4,
	// Minimum estimated clearance gradient magnitude for projection.
	minimumGradientRatio: 0.35,
	// Iteration budget for solving the setback contour.
	projectionPassCount: 5,
	// Residual clearance at which projection stops.
	projectionToleranceM: 0.08,
	// Largest residual clearance accepted when the projection budget runs out.
	projectionFallbackToleranceM: 0.5,
	// Tangential correction toward the mean of the two rail neighbors.
	tangentRelaxationRatio: 0.8,
	// Required depth at the midpoint of the width probe, as a share of its length.
	widthProbeDepthRatio: 0.2,
	// Passes for diffusing bank displacement through neighboring nodes.
	diffusionPassCount: 14,
	// Neighbor displacement retained by each diffusion pass before the distance fade.
	diffusionRetentionRatio: 0.98,
	// Passes allowed to gradually reduce a rejected displacement before dropping it.
	guardPassCount: 15,
	// Attempts to recover an anchor after the surrounding cells pass the guard.
	anchorRecoveryPassCount: 6,
	// Displacement retained after a cell fails a guard check.
	guardRetentionRatio: 0.78,
	// Rounding allowance in the interior angle comparison.
	guardAngleToleranceRad: 1e-10,
	// Rounding allowance in the edge length comparison.
	guardEdgeToleranceM: 1e-9,
	// Smallest accepted area of a clipped cell relative to its nominal area.
	clippedMinimumAreaRatio: 0.24,
	// Shortest edge of a clipped cell relative to the nominal cell side.
	clippedMinimumEdgeRatio: 0.1,
	// Smallest interior angle of a clipped cell.
	clippedMinimumAngleRad: Math.PI / 12,
	// Largest squared diameter divided by area of a clipped cell.
	clippedMaximumAspectRatio: 6,
	// Precision of a shared edge's intersection with the setback.
	clipToleranceM: 0.05,
	// Maximum spacing for the city cell ground and rise checks.
	groundSampleStepM: 8,
	// Smallest interval probed when a segment grazes the setback.
	clearanceSampleStepM: 0.25,
	// Minimum dry clearance from water for a city lot.
	cityBankSetbackM: 3,
	// Study target for the share of occupied shore cells that keep all their plan nodes.
	targetUnclippedShare: 0.5,
	// Study target for the share of bank edges within the setback tolerance.
	targetAlignedEdgeShare: 0.5
});

/** Measurements and selection defaults for city crossings addressed by the plan grid. */
export const crossingLimits = Object.freeze({
	// Longest eligible edge path between crossing heads.
	maximumPathLengthM: 320,
	// Minimum distance between candidate crossing midpoints.
	spacingM: 105,
	// Maximum spacing between probes along a crossing chord.
	channelSampleStepM: 5,
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
