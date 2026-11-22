import { courseProjection } from './course-projection';
import type { RiverCourse } from './course';
import { heightAboveWaterM } from './ground-profile';
import { toMillimeters } from './millimeters';
import { axisCoordinates, type ValleyAxis } from './valley-axis';

/** Ground bands in ascending order from the channel to the outer slope. */
export const valleyBands = Object.freeze(['channel', 'floodplain', 'terraces', 'slopes'] as const);

/** Index into valleyBands. */
export type ValleyBand = 0 | 1 | 2 | 3;

/** North-first square raster in meters. Columns run east and rows run south. */
export type HeightGrid = Readonly<{
	origin: readonly [west: number, north: number];
	cellSize: number;
	side: number;
	heights: readonly number[];
	waterHeights: readonly number[];
	bands: readonly ValleyBand[];
}>;

export const windowSize = 2000;
const cellSize = 12.5;
const half = windowSize / 2;

export function groundSampler(course: RiverCourse, axis: ValleyAxis) {
	const project = courseProjection(course);
	const coordinates = axisCoordinates(axis);
	const wetHalf = toMillimeters(course.wetWidth / 2);
	return (x: number, y: number) => {
		const xMm = toMillimeters(x);
		const yMm = toMillimeters(y);
		const { alongM, stationM, acrossM } = coordinates(xMm, yMm);
		const water = -alongM * axis.profile.valleySlope;
		const above = heightAboveWaterM(axis, stationM, acrossM, (project(xMm, yMm) - wetHalf) / 1000);
		return { height: toMillimeters(water + above) / 1000, water: toMillimeters(water) / 1000 };
	};
}

export function heightGrid(sample: ReturnType<typeof groundSampler>, axis: ValleyAxis): HeightGrid {
	const side = windowSize / cellSize + 1;
	const heights = new Array<number>(side ** 2);
	const waterHeights = new Array<number>(side ** 2);
	const bands = new Array<ValleyBand>(side ** 2);
	const [floodplain, lower, upper] = axis.floors;
	const lowerEdge = toMillimeters((floodplain.levelM + lower.levelM) / 2);
	const upperEdge = toMillimeters((lower.levelM + upper.levelM) / 2);
	for (let row = 0; row < side; row++) {
		for (let column = 0; column < side; column++) {
			const index = row * side + column;
			const { height, water } = sample(-half + column * cellSize, half - row * cellSize);
			const above = Math.round((height - water) * 1000);
			heights[index] = height;
			waterHeights[index] = water;
			bands[index] = above < 0 ? 0 : above < lowerEdge ? 1 : above < upperEdge ? 2 : 3;
		}
	}
	return Object.freeze({
		origin: Object.freeze([-half, half] as const),
		cellSize,
		side,
		heights: Object.freeze(heights),
		waterHeights: Object.freeze(waterHeights),
		bands: Object.freeze(bands)
	});
}
