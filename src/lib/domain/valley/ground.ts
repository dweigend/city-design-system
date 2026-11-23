import type { Random } from '../../core/random';
import { regionalProfile, smoothstep } from './regional-profile';
import { courseProjection } from './course-projection';
import type { RiverCourse } from './course';
import { axisBow, beyondFootM, heightAboveWaterM } from './ground-profile';
import { flattenedAlong, LAKE_DEFAULTS, lakeDistance, type Lake, type LakeReach } from './lake';
import type { MountainFlanks } from './relief';
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
const bankInfluence = 160;
const maxRegionalWidthShift = 45;

/** Optional mountain flanks and lake that shape the ground beyond the alluvial profile. */
export type Landforms = Readonly<{
	flanks: MountainFlanks;
	lake: Omit<Lake, 'level'> | null;
	lakeReach: LakeReach | null;
}>;

function bedBelowLake(lake: Landforms['lake'], x: number, y: number) {
	if (!lake) return { distance: Infinity, bed: Infinity };
	const distance = lakeDistance(lake, x, y);
	if (distance >= 0) return { distance, bed: Infinity };
	const t = Math.min(1, -distance / LAKE_DEFAULTS.bedRunM);
	return { distance, bed: -lake.depth * t * (2 - t) };
}

export function groundSampler(
	course: RiverCourse,
	axis: ValleyAxis,
	random: Random,
	{ flanks, lake, lakeReach }: Landforms
) {
	const project = courseProjection(course);
	const coordinates = axisCoordinates(axis);
	const regional = regionalProfile(course, random);
	const wetHalf = toMillimeters(course.wetWidth / 2);
	// Beyond this cutoff both the bank skirt and the regional shoulder are fully dry.
	const limit = wetHalf + toMillimeters(bankInfluence + maxRegionalWidthShift);
	const landform = (stationM: number, lateral: number, rate: number, bank: number) => {
		const beyond = beyondFootM(axis, stationM, lateral, rate, flanks.footNarrowing);
		return flanks.heightM(stationM, lateral, beyond) * smoothstep(bank / bankInfluence);
	};
	return (x: number, y: number) => {
		const xMm = toMillimeters(x);
		const yMm = toMillimeters(y);
		const { alongM, stationM, acrossM } = coordinates(xMm, yMm);
		const water = -flattenedAlong(lakeReach, alongM) * axis.profile.valleySlope;
		const river = (project(xMm, yMm, limit) - wetHalf) / 1000;
		const basin = bedBelowLake(lake, x, y);
		const regionalRate = Math.hypot(x, y) <= 1420 ? null : regional(x, y);
		const rate = regionalRate?.rate ?? 0;
		const lateralBow = axisBow(axis, stationM);
		const across = regionalRate
			? acrossM + (regionalRate.lateral + lateralBow - acrossM) * rate
			: acrossM;
		const bank = Math.min(river - (regionalRate?.bankWidth ?? 0), basin.distance);
		let above = Math.min(heightAboveWaterM(axis, stationM, across, bank, rate), basin.bed);
		if (regionalRate) above += regionalRate.shoulder * smoothstep(bank / bankInfluence);
		above += landform(stationM, across - lateralBow, rate, bank);
		return {
			height: toMillimeters(water + above) / 1000,
			water: toMillimeters(water) / 1000,
			bank: Math.min(bank, bankInfluence)
		};
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
