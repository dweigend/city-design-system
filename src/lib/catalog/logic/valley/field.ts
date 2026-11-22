import { heightAboveWaterM } from './ground-profile';
import { axisCoordinates } from './valley-axis';
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
	const coordinates = axisCoordinates(valley.axis);
	const [floodplain, lower, upper] = valley.floors;
	const lowerMm = toMillimeters((floodplain.levelM + lower.levelM) / 2);
	const upperMm = toMillimeters((lower.levelM + upper.levelM) / 2);
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const index = row * side + column;
			const xMm = column * spacingMm - half;
			const yMm = half - row * spacingMm;
			const { alongM, acrossM } = coordinates(xMm, yMm);
			const water = -alongM * valley.valleySlope;
			const distanceToBankM = (project(xMm, yMm) - wetHalfWidthMm) / 1000;
			const height = heightAboveWaterM(valley.axis, alongM, acrossM, distanceToBankM);
			meanWaterMm[index] = toMillimeters(water);
			bedMm[index] = toMillimeters(water + height);
			const aboveWater = bedMm[index] - meanWaterMm[index];
			const level = floorIndex(aboveWater, lowerMm, upperMm);
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

function floorIndex(aboveWaterMm: number, lowerMm: number, upperMm: number): 0 | 1 | 2 | 3 {
	if (aboveWaterMm < 0) return 0;
	if (aboveWaterMm < lowerMm) return 1;
	return aboveWaterMm < upperMm ? 2 : 3;
}
