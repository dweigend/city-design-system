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
	// Smallest interval probed when a segment grazes the setback.
	clearanceSampleStepM: 0.25,
	// Study target for the share of occupied shore cells that keep all their plan nodes.
	targetUnclippedShare: 0.5,
	// Study target for the share of bank edges within the setback tolerance.
	targetAlignedEdgeShare: 0.5
});
