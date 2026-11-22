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
	stationM: number,
	acrossM: number,
	distanceToBankM: number
): number {
	const { profile } = axis;
	if (distanceToBankM < 0) return -profile.bedDepthM * ramp(-distanceToBankM, profile.bedRunM);
	const t = stationM / axis.bowSpanM;
	const absT = Math.abs(t);
	const bow = absT < 1 ? t * t : 2 * absT - 1;
	const lateral = acrossM - axis.bowM * bow;
	const distance = Math.abs(lateral);
	const edge =
		Math.sign(lateral) === axis.openSide ? axis.openEdgeM + axis.wideningM * t : axis.closeEdgeM;
	const upperEdge = edge + profile.upperSetbackM;
	const [floodplain, lower, upper] = axis.floors;
	const relief =
		floodplain.levelM +
		(lower.levelM - floodplain.levelM) * rise(distance, edge, profile.firstHalfRunM) +
		(upper.levelM - lower.levelM) * rise(distance, upperEdge, profile.secondHalfRunM) +
		profile.apronRiseM * rise(distance, upperEdge + profile.apronSetbackM, profile.apronHalfRunM);
	return relief * ramp(distanceToBankM, profile.bankRunM);
}
