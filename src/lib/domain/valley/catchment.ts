import type { Random } from '../../core/random';
import { limitSlopes, position, side, spacing } from './catchment-grid';
import type { RiverCourse } from './course';
import { courseProjection } from './course-projection';
import { axisBow, heightAboveWaterM } from './ground-profile';
import { toMillimeters } from './millimeters';
import { regionalProfile } from './regional-profile';
import { trough } from './trough';
import { uplifts } from './uplifts';
import { axisCoordinates, type ValleyAxis } from './valley-axis';

export function regionalGround(
	guide: RiverCourse,
	axis: ValleyAxis,
	random: Random,
	relief: number
) {
	const offset = axisCoordinates(axis);
	const belt = regionalProfile(guide, random.derive('regional'));
	const uplift = uplifts(random.derive('catchment/uplift'), relief);
	const distance = courseProjection(guide);
	const u = Math.cos(guide.bearing);
	const v = Math.sin(guide.bearing);
	const datum = (x: number, y: number) => -(x * u + y * v) * axis.profile.valleySlope;
	const terraces = (x: number, y: number) => {
		const { stationM, acrossM } = offset(toMillimeters(x), toMillimeters(y));
		if (x * x + y * y <= 1420 ** 2) return heightAboveWaterM(axis, stationM, acrossM);
		const { rate, lateral, shoulder } = belt(x, y);
		const across = acrossM + (lateral + axisBow(axis, stationM) - acrossM) * rate;
		return heightAboveWaterM(axis, stationM, across, rate) + shoulder;
	};
	const ground = (x: number, y: number) => {
		const fromTrough = distance(toMillimeters(x), toMillimeters(y), 2_000_000) / 1000;
		const land = terraces(x, y) + uplift(x, y, fromTrough);
		const foothill = Math.min(1, fromTrough / (240 - 120 * relief));
		// Continue the very shallow fall across the floodplain into the side valleys.
		return datum(x, y) + land * foothill + 0.0014 * relief * fromTrough;
	};
	return { ground, terraces, datum };
}

export function createCatchment(
	guide: RiverCourse,
	axis: ValleyAxis,
	random: Random,
	relief: number
) {
	const field = regionalGround(guide, axis, random, relief);
	const bed = new Int32Array(side ** 2);
	for (let i = 0; i < bed.length; i++) bed[i] = toMillimeters(field.ground(...position(i)));
	const spine = trough(guide);
	let previous = Infinity;
	for (const { index, x, y } of spine) {
		bed[index] = Math.min(previous - 1, toMillimeters(field.datum(x, y)));
		previous = bed[index];
	}
	limitSlopes(bed);
	return { grid: { side, spacing, bed }, spine, field };
}
