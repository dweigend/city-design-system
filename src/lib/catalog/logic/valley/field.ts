import { VALLEY_FLOORS, heightAboveWaterM } from './ground-profile';
import { courseProjection } from './course-projection';
import { toMillimeters } from './millimeters';
import type { Valley } from './snapshot';

type ValleyGrid = Readonly<{ windowM: number; spacingM: number }>;

export type ValleyField = ValleyGrid &
	Readonly<{
		version: Valley['version'];
		seed: number;
		bedMm: Int32Array;
		meanWaterMm: Int32Array;
		floor: Uint8Array;
		classes: Uint8Array;
	}>;

const GRID = Object.freeze({ windowM: 2000, spacingM: 12.5 });
const MID_LOWER_MM = toMillimeters((VALLEY_FLOORS[0].levelM + VALLEY_FLOORS[1].levelM) / 2);
const MID_UPPER_MM = toMillimeters((VALLEY_FLOORS[1].levelM + VALLEY_FLOORS[2].levelM) / 2);
const CLASS_BY_FLOOR = [1, 2, 4, 4 | 32] as const;

/**
 * Samples a valley into a detached 2 km square with 161² points, row zero north.
 * Elevations are in millimeters. Invalid grid sizes throw before allocation.
 */
export function sampleValley(valley: Valley, { windowM, spacingM }: ValleyGrid): ValleyField {
	if (windowM !== GRID.windowM || spacingM !== GRID.spacingM) {
		throw new RangeError('invalid-valley-grid');
	}
	const side = windowM / spacingM + 1;
	const bedMm = new Int32Array(side ** 2);
	const meanWaterMm = new Int32Array(side ** 2);
	const floor = new Uint8Array(side ** 2);
	const classes = new Uint8Array(side ** 2);
	const half = toMillimeters(windowM / 2);
	const spacingMm = toMillimeters(spacingM);
	const wetHalfWidthMm = toMillimeters(valley.course.wetWidthM / 2);
	const project = courseProjection(valley.course);
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const index = row * side + column;
			const { stationMm, offsetMm } = project(column * spacingMm - half, half - row * spacingMm);
			const water = (-stationMm * valley.valleySlope) / 1000;
			const height = heightAboveWaterM(valley.course, stationMm, offsetMm, wetHalfWidthMm);
			meanWaterMm[index] = toMillimeters(water);
			bedMm[index] = toMillimeters(water + height);
			const aboveWater = bedMm[index] - meanWaterMm[index];
			const level = floorIndex(aboveWater);
			floor[index] = level;
			classes[index] = CLASS_BY_FLOOR[level];
		}
	}
	return Object.freeze({
		version: valley.version,
		seed: valley.seed,
		...GRID,
		bedMm,
		meanWaterMm,
		floor,
		classes
	});
}

function floorIndex(aboveWaterMm: number): 0 | 1 | 2 | 3 {
	if (aboveWaterMm < 0) return 0;
	if (aboveWaterMm < MID_LOWER_MM) return 1;
	return aboveWaterMm < MID_UPPER_MM ? 2 : 3;
}
