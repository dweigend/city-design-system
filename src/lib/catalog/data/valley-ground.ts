/** Large-lowland edge profiles, in meters, with dimensionless axis bow gain and downstream fall. */
export const VALLEY_GROUND_DEFAULTS = {
	floodplainLevelM: 1.4,
	firstRiseM: [6.2, 7] as const,
	secondRiseM: [9.1, 9.55] as const,
	closeEdgeM: [275, 305] as const,
	openEdgeM: [535, 725] as const,
	wideningM: [-80, 110] as const,
	axisBowGain: [0.23, 0.34] as const,
	axisReachM: 1125,
	upperSetbackM: 162,
	firstHalfRunM: 24,
	secondHalfRunM: 31,
	bedDepthM: 3.1,
	bedRunM: 80,
	bankRunM: 36,
	apronRiseM: 1.4,
	apronSetbackM: 310,
	apronHalfRunM: 220,
	valleySlope: 0.00025
} as const;
