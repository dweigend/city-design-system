import type { ValleyAxis } from './valley-axis';

function ramp(distanceM: number, runM: number): number {
	const t = Math.min(1, distanceM / runM);
	return t * (2 - t);
}

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

/** Distance in meters beyond the flank foot, where the apron meets the mountains. The foot
 * moves inward by the given share of the apron setback. Negative on the valley floor. */
export function beyondFootM(
	axis: ValleyAxis,
	stationM: number,
	lateral: number,
	regionalRate: number,
	narrowing: number
): number {
	const { profile } = axis;
	const foot =
		terraceEdgeM(axis, stationM, lateral, regionalRate) +
		profile.upperSetbackM +
		profile.apronSetbackM * (1 - narrowing);
	return Math.abs(lateral) - foot;
}

/** Samples valley-axis relief in meters above mean water. Only the bank skirt reads the river. */
export function heightAboveWaterM(
	axis: ValleyAxis,
	stationM: number,
	acrossM: number,
	distanceToBankM: number,
	regionalRate = 0
): number {
	const { profile } = axis;
	if (distanceToBankM < 0) return -profile.bedDepthM * ramp(-distanceToBankM, profile.bedRunM);
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
	return relief * ramp(distanceToBankM, profile.bankRunM);
}
