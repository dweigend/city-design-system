/** Terrain sampling and plan limits for city sites. */
export const citySiteConfig = Object.freeze({
	coarseCellSizeM: 60, // Equivalent square side of a typical plan cell.
	bankSetbackM: 3, // Minimum clearance from water for occupied ground.
	groundSampleStepM: 8, // Maximum spacing between occupied-ground probes.
	maximumCellRiseM: 16, // Maximum sampled elevation range within one buildable cell.
	minimumRegionAreaM2: 360_000, // Minimum eligible area for an independent growth region.
	windowSampleStepM: 12, // Target sample spacing for an alternate terrain window.
	windowMaxIntervals: 128, // Maximum sample intervals along either window axis.
	crossingMaxLengthM: 320, // Maximum length of a candidate crossing edge path.
	crossingProbeStepM: 5, // Maximum chord sample spacing when checking for a channel.
	crossingSpacingM: 105, // Minimum spacing between candidate crossings.
	crossingMaxHeadDepthM: 18 // Maximum bank head depth relative to the shoreline.
});
