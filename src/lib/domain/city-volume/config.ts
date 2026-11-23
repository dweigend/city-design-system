/** Coarse building levels and density thresholds. */
export const cityVolumeConfig = Object.freeze({
	storeyHeightM: 3.5, // World height of one storey.
	storeysPerLevel: 2, // Storeys on one coarse lattice level.
	maximumOccupiedBands: 256, // Maximum foundation and above-ground bands in one column.
	townAreaKm2: 1, // Area at which block density appears.
	cityAreaKm2: 3, // Area at which center density appears.
	detachedLevels: 1, // Nominal height of detached stock.
	blockLevels: 3, // Nominal height of the block podium.
	maximumNeighborStepLevels: 3, // Maximum nominal height difference across a plan edge.
	firstPeakLevels: 6, // Nominal peak when the center first appears.
	fullPeakLevels: 15, // Maximum nominal height of a column.
	fullPeakAreaKm2: 8, // Area at which the nominal peak reaches its cap.
	firstBlockShare: 0.18, // Block share when the town first appears.
	blockSharePerKm2: 0.09, // Additional block share per square kilometre above the town threshold.
	maximumBlockShare: 0.45, // Cap on the block share.
	firstCenterShare: 0.05, // Center share when the city first appears.
	centerSharePerKm2: 0.01, // Additional center share per square kilometre above the city threshold.
	maximumCenterShare: 0.1, // Cap on the center share.
	verticalChildCount: 2, // Equal divisions of each bay band.
	corridorStepM: 85, // Length of one proposed accessibility arm segment.
	corridorProbeStepM: 5, // Maximum spacing between dry corridor probes.
	hubWeightTolerance: 1e-9 // Barycentric tolerance when sampling a clamped cap.
});
