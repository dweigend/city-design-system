import { defaults } from '../../../config/hydrology';

export { defaults };

const {
	floodplainLevelM,
	lowerTerraceRiseBandM,
	upperTerraceRiseBandM,
	nearTerraceEdgeBandM,
	farTerraceEdgeBandM,
	farTerraceWideningBandM,
	valleyAxisBowGainBandRatio,
	valleyAxisChordReachM,
	upperSetbackM,
	lowerTerraceTransitionHalfRunM,
	upperTerraceTransitionHalfRunM,
	apronRiseM,
	apronSetbackM,
	apronHalfRunM,
	valleyDatumSlopeRatio
} = defaults;

/** Large-lowland ground defaults in meters, except for bow gain and downstream fall. */
export const VALLEY_GROUND_DEFAULTS = {
	floodplainLevelM,
	firstRiseM: lowerTerraceRiseBandM,
	secondRiseM: upperTerraceRiseBandM,
	closeEdgeM: nearTerraceEdgeBandM,
	openEdgeM: farTerraceEdgeBandM,
	wideningM: farTerraceWideningBandM,
	axisBowGain: valleyAxisBowGainBandRatio,
	axisReachM: valleyAxisChordReachM,
	upperSetbackM,
	firstHalfRunM: lowerTerraceTransitionHalfRunM,
	secondHalfRunM: upperTerraceTransitionHalfRunM,
	apronRiseM,
	apronSetbackM,
	apronHalfRunM,
	valleySlope: valleyDatumSlopeRatio
} as const;
