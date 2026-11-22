import { hash } from '../../core/random';
import type { ValleyGroundProfile } from '../../data/valley-ground';
import type { RiverCourse } from './course';
import { sampleBand, type ValleyParameters } from './parameters';
import { openBankSide } from './window-placement';

const CHANNEL = { width: 6, heights: 8, tilt: 9 } as const;

function reachChord(course: RiverCourse, reachM: number) {
	const midpoint = (course.chainageM.length - 1) / 2;
	const distance = Math.round(reachM / course.chainageM[1]);
	const a = 2 * (midpoint - distance);
	const b = 2 * (midpoint + distance);
	const { xy } = course;
	const x = xy[2 * midpoint];
	const y = xy[2 * midpoint + 1];
	const dx = xy[b] - xy[a];
	const dy = xy[b + 1] - xy[a + 1];
	const bearingRad = Math.atan2(dy, dx);
	const spanM = Math.hypot(dx, dy) / 2;
	const crossM = Math.cos(bearingRad) * (xy[a + 1] - y) - Math.sin(bearingRad) * (xy[a] - x);
	return { x, y, spanM, bearingRad, crossM };
}

/** Builds the alluvial profile and an independently tilted axis in the course frame. */
export function createValleyAxis(
	seed: number,
	course: RiverCourse,
	parameters: ValleyParameters,
	profile: ValleyGroundProfile
) {
	const openSide = openBankSide(seed, parameters.openBank);
	const width = sampleBand(parameters.groundVariation, hash(seed, 0, CHANNEL.width));
	const height = sampleBand(parameters.groundHeightVariation, hash(seed, 0, CHANNEL.heights));
	const tiltRad = sampleBand(parameters.axisTiltRad, hash(seed, 0, CHANNEL.tilt));
	const reach = reachChord(course, profile.axisReachM);
	const floodplain = profile.floodplainLevelM;
	const lower = floodplain + sampleBand(profile.firstRiseM, height);
	const upper = lower + sampleBand(profile.secondRiseM, height);
	return Object.freeze({
		profile,
		anchorX: reach.x,
		anchorY: reach.y,
		bearingRad: reach.bearingRad + tiltRad,
		tiltRad,
		bowM: reach.crossM * sampleBand(profile.axisBowGain, width),
		bowSpanM: reach.spanM,
		openSide,
		closeEdgeM: sampleBand(profile.closeEdgeM, width),
		openEdgeM: sampleBand(profile.openEdgeM, width),
		wideningM: sampleBand(profile.wideningM, width),
		floors: Object.freeze([
			Object.freeze({ id: 1, kind: 'floodplain', levelM: floodplain }),
			Object.freeze({ id: 2, kind: 'lower-terrace', levelM: lower }),
			Object.freeze({ id: 3, kind: 'upper-terrace', levelM: upper })
		] as const)
	});
}

export type ValleyAxis = ReturnType<typeof createValleyAxis>;

/** Resolves grounded coordinates from XY millimeters, with the water datum at the frame origin. */
export function axisCoordinates(axis: ValleyAxis) {
	const forwardX = Math.cos(axis.bearingRad);
	const forwardY = Math.sin(axis.bearingRad);
	const alongOffset = forwardX * axis.anchorX + forwardY * axis.anchorY;
	const acrossOffset = forwardX * axis.anchorY - forwardY * axis.anchorX;
	return (xMm: number, yMm: number) => {
		const alongM = Math.round(forwardX * xMm + forwardY * yMm) / 1000;
		return {
			alongM,
			stationM: alongM - alongOffset,
			acrossM: Math.round(forwardX * yMm - forwardY * xMm) / 1000 - acrossOffset
		};
	};
}
