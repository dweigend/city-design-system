import { hash } from '../../core/random';
import { VALLEY_GROUND_DEFAULTS as defaults } from '../../data/valley-ground';
import type { RiverCourse } from './course';
import { sampleBand, type ValleyParameters } from './parameters';

const AXIS_CHANNEL = { bank: 5, variation: 6 } as const;

/** Builds the alluvial profile and its independent axis in the course's world frame. */
export function createValleyAxis(seed: number, course: RiverCourse, parameters: ValleyParameters) {
	const opening =
		parameters.openBank ?? (hash(seed, 0, AXIS_CHANNEL.bank) < 0.5 ? 'left' : 'right');
	const openSide = opening === 'left' ? 1 : -1;
	const shape = sampleBand(parameters.groundVariation, hash(seed, 0, AXIS_CHANNEL.variation));
	const halfReach = Math.round(defaults.axisReachM / course.chainageM[1]);
	const midpoint = (course.chainageM.length - 1) / 2;
	const a = 2 * (midpoint - halfReach);
	const b = 2 * (midpoint + halfReach);
	const { xy } = course;
	const bearingRad = Math.atan2(xy[b + 1] - xy[a + 1], xy[b] - xy[a]);
	const floodplain = defaults.floodplainLevelM;
	const lower = floodplain + sampleBand(defaults.firstRiseM, shape);
	const upper = lower + sampleBand(defaults.secondRiseM, shape);

	return Object.freeze({
		bearingRad,
		openSide,
		bowM:
			-Math.sin(course.phaseOffset + course.windowPhaseOffset) *
			defaults.axisReachM *
			sampleBand(defaults.axisBowGain, shape),
		closeEdgeM: sampleBand(defaults.closeEdgeM, shape),
		openEdgeM: sampleBand(defaults.openEdgeM, shape),
		wideningM: sampleBand(defaults.wideningM, shape),
		floors: Object.freeze([
			Object.freeze({ id: 1, kind: 'floodplain', levelM: floodplain }),
			Object.freeze({ id: 2, kind: 'lower-terrace', levelM: lower }),
			Object.freeze({ id: 3, kind: 'upper-terrace', levelM: upper })
		] as const)
	});
}

export type ValleyAxis = ReturnType<typeof createValleyAxis>;

/** Resolves station and cross-axis coordinates in meters from XY millimeters. */
export function axisCoordinates(axis: ValleyAxis) {
	const forwardX = Math.cos(axis.bearingRad);
	const forwardY = Math.sin(axis.bearingRad);
	return (xMm: number, yMm: number) => ({
		alongM: Math.round(forwardX * xMm + forwardY * yMm) / 1000,
		acrossM: Math.round(forwardX * yMm - forwardY * xMm) / 1000
	});
}
