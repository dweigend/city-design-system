import type { ValleyAxis } from './valley-axis';

function rise(distanceM: number, centerM: number, halfRunM: number): number {
	const t = Math.min(1, Math.max(0, (distanceM - centerM + halfRunM) / (2 * halfRunM)));
	return t * t * (3 - 2 * t);
}

export function axisBow(axis: ValleyAxis, stationM: number) {
	const t = Math.abs(stationM / axis.bowSpanM);
	return axis.bowM * (t < 1 ? t * t : 2 * t - 1);
}

/** Distance in meters from the valley axis to the lower terrace edge on the side of a signed
 * lateral offset, blended toward the meander-belt edge by the regional rate. */
export function terraceEdgeM(
	axis: ValleyAxis,
	stationM: number,
	lateral: number,
	regionalRate: number
): number {
	const open = Math.sign(lateral) === axis.openSide;
	const localEdge = open
		? axis.openEdgeM + axis.wideningM * (stationM / axis.bowSpanM)
		: axis.closeEdgeM;
	const beltEdge = open ? 690 : 475;
	return localEdge + (beltEdge - localEdge) * regionalRate;
}

/** Samples the inherited floodplain and two terrace benches above the datum. */
export function heightAboveWaterM(
	axis: ValleyAxis,
	stationM: number,
	acrossM: number,
	regionalRate = 0
): number {
	const { profile } = axis;
	const lateral = acrossM - axisBow(axis, stationM);
	const distance = Math.abs(lateral);
	const edge = terraceEdgeM(axis, stationM, lateral, regionalRate);
	const upperEdge = edge + profile.upperSetbackM;
	const [floodplain, lower, upper] = axis.floors;
	const relief =
		floodplain.levelM +
		(lower.levelM - floodplain.levelM) * rise(distance, edge, profile.firstHalfRunM) +
		(upper.levelM - lower.levelM) * rise(distance, upperEdge, profile.secondHalfRunM) +
		profile.apronRiseM * rise(distance, upperEdge + profile.apronSetbackM, profile.apronHalfRunM);
	return relief;
}
