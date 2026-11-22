import { VALLEY_GROUND_DEFAULTS as defaults } from '../../data/valley-ground';
import type { ValleyAxis } from './valley-axis';

function ramp(distanceM: number, runM: number): number {
	const t = Math.min(1, distanceM / runM);
	return t * (2 - t);
}

function rise(distanceM: number, centerM: number, halfRunM: number): number {
	const t = Math.min(1, Math.max(0, (distanceM - centerM + halfRunM) / (2 * halfRunM)));
	return t * t * (3 - 2 * t);
}

/** Samples valley-axis relief in meters above mean water. Only the bank skirt reads the river. */
export function heightAboveWaterM(
	axis: ValleyAxis,
	alongM: number,
	acrossM: number,
	distanceToBankM: number
): number {
	if (distanceToBankM < 0) return -defaults.bedDepthM * ramp(-distanceToBankM, defaults.bedRunM);
	const t = alongM / defaults.axisReachM;
	const lateral = acrossM - axis.bowM * t * t;
	const distance = Math.abs(lateral);
	const edge =
		Math.sign(lateral) === axis.openSide ? axis.openEdgeM + axis.wideningM * t : axis.closeEdgeM;
	const upperEdge = edge + defaults.upperSetbackM;
	const [floodplain, lower, upper] = axis.floors;
	const relief =
		floodplain.levelM +
		(lower.levelM - floodplain.levelM) * rise(distance, edge, defaults.firstHalfRunM) +
		(upper.levelM - lower.levelM) * rise(distance, upperEdge, defaults.secondHalfRunM) +
		defaults.apronRiseM *
			rise(distance, upperEdge + defaults.apronSetbackM, defaults.apronHalfRunM);
	return relief * ramp(distanceToBankM, defaults.bankRunM);
}
