import { millimetersPerMeter } from './millimeters';
import type { Random } from '../../core/random';
import { VALLEY_GROUND_DEFAULTS as profile } from './settings';
import { courseSpacing, type RiverCourse } from './course';
import { defaultBands, sampleBand } from './parameters';

function reachChord(course: RiverCourse, reachM: number) {
	const midpoint = (course.xy.length / 2 - 1) / 2;
	const distance = Math.round(reachM / courseSpacing);
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

// Exact arithmetic: the floodplain and two terraced floor IDs are ordered and stable.
const floorId = {
	floodplain: /* Exact arithmetic: floor band indices above the channel. */ 1,
	lowerTerrace: /* Exact arithmetic: floor band indices above the channel. */ 2,
	upperTerrace: /* Exact arithmetic: floor band indices above the channel. */ 3
} as const;

/** Builds the alluvial profile and an independently tilted axis in the course frame. */
export function createValleyAxis(random: Random, course: RiverCourse, openSide: number) {
	const width = random.derive('setbacks').number();
	const height = random.derive('elevations').number();
	const tiltRad = sampleBand(defaultBands.axisTilt, random.derive('tilt').number());
	const reach = reachChord(course, profile.axisReachM);
	const floodplain = profile.floodplainLevelM;
	const lower = floodplain + sampleBand(profile.firstRiseM, height);
	const upper = lower + sampleBand(profile.secondRiseM, height);
	return Object.freeze({
		profile,
		anchorX: reach.x,
		anchorY: reach.y,
		bearingRad: reach.bearingRad + tiltRad,
		bowM: reach.crossM * sampleBand(profile.axisBowGain, width),
		bowSpanM: reach.spanM,
		openSide,
		closeEdgeM: sampleBand(profile.closeEdgeM, width),
		openEdgeM: sampleBand(profile.openEdgeM, width),
		wideningM: sampleBand(profile.wideningM, width),
		floors: Object.freeze([
			Object.freeze({ id: floorId.floodplain, kind: 'floodplain', levelM: floodplain }),
			Object.freeze({ id: floorId.lowerTerrace, kind: 'lower-terrace', levelM: lower }),
			Object.freeze({ id: floorId.upperTerrace, kind: 'upper-terrace', levelM: upper })
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
		const alongM = Math.round(forwardX * xMm + forwardY * yMm) / millimetersPerMeter;
		return {
			alongM,
			stationM: alongM - alongOffset,
			acrossM: Math.round(forwardX * yMm - forwardY * xMm) / millimetersPerMeter - acrossOffset
		};
	};
}
