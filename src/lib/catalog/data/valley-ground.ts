/** Large-lowland ground defaults in meters, except for bow gain and downstream fall. */
export const VALLEY_GROUND_DEFAULTS = {
	floodplainLevelM: 1.4,
	firstRiseM: [6.2, 7] as const,
	secondRiseM: [9.1, 9.55] as const,
	closeEdgeM: [325, 355] as const,
	openEdgeM: [590, 666] as const,
	wideningM: [-35, 65] as const,
	axisBowGain: [0.95, 1.05] as const,
	axisReachM: 1125,
	upperSetbackM: 158,
	firstHalfRunM: 24,
	secondHalfRunM: 38,
	bedDepthM: 3.1,
	bedRunM: 80,
	bankRunM: 36,
	apronRiseM: 1.4,
	apronSetbackM: 310,
	apronHalfRunM: 220,
	valleySlope: 0.00025
} as const;

export type ValleyGroundProfile = {
	readonly [
		K in keyof typeof VALLEY_GROUND_DEFAULTS
	]: (typeof VALLEY_GROUND_DEFAULTS)[K] extends number ? number : readonly [number, number];
};
