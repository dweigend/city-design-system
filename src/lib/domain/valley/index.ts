/** Module: Generates a seeded catchment, solves drainage and samples terrain. */
import { defaults } from './settings';
import type { Vec2, Vec3 } from '../../core/geometry';
import { Random, uint32Limit } from '../../core/random';
import { resolveParams } from '../../core/params';
import { generateCourse, type RiverCourse } from './course';
import { heightGrid, valleyBands, windowSize, type HeightGrid } from './ground';
import { valleyParams } from './parameters';
import { drainageTerrain } from './drainage-terrain';
import type { DrainageLake } from './lake-geometry';
import type { DrainageCheck } from './drainage-check';
import type { Reach } from './reaches';
import { terrainSampler } from './terrain-sample';
import { trunkCourse } from './trunk-course';
import { readGround, type GroundReading } from './reading';
import {
	surveyDefaults,
	surveyGround,
	type GroundSurvey,
	type HydrologyFaults,
	type SurveyWindow
} from './survey';
import { axisBow } from './ground-profile';
import { createValleyAxis } from './valley-axis';

const {
	sinuosityRoundingDigits,
	reliefRoundingDigits,
	runoffRoundingDigits,
	openBankPositiveSideProbability,
	valleyFrameBearingRad,
	minimumImportedWetWidthM,
	terraceFrameStationLimitM,
	terraceFrameDrySearchStepM,
	terraceFrameDrySearchLimitM
} = defaults;

/** World-space polygons of the solved channel outline. */
export { channelPolygons } from './channel-outline';
/** Channel width in meters for discharge in cubic meters per second. */
export { channelWidth } from './reaches';

/** Public numeric controls and their units and bounds. */
export { valleyParams } from './parameters';
/** Nominal uplift amplitude in meters for a relief ratio. */
export { peakHeightM } from './uplifts';
/** Index order for named ground bands on the raster. */
export { valleyBands } from './ground';
export type { Reach, ReachStation } from './reaches';
export type { DrainageCheck } from './drainage-check';
export type { WaterKind } from './terrain-sample';
export type {
	GroundReading,
	GroundSurvey,
	HydrologyFaults,
	HeightGrid,
	DrainageLake,
	RiverCourse,
	SurveyWindow
};
/** Default survey window: 4 km square, 20 m spacing, buildable below a 20 % slope. */
export { surveyDefaults } from './survey';

/** Measures a valley in a square window around its center: lowest, highest and relief in
 * meters, steepest node slope, water share, lake area in m², the share of dry nodes below the
 * buildable slope, and hydrology faults (all zero when sound). Pure; samples each node once.
 * Invalid windows throw RangeError. */
export function surveyValley(
	valley: Readonly<Pick<Valley, 'sampleTerrain' | 'reaches'>>,
	window: SurveyWindow = surveyDefaults
): GroundSurvey {
	return surveyGround(valley.sampleTerrain, valley.reaches, window);
}

/** Resolved sinuosity, relief and runoff ratios. */
export type ValleySettings = Readonly<{ sinuosity: number; relief: number; runoff: number }>;

/** Wall time in milliseconds for each construction stage. */
export type ValleyTiming = Readonly<{
	baseMs: number;
	floodMs: number;
	reachesMs: number;
	gridMs: number;
}>;

/** Seed and optional parameters. Wet width calibrates imported flow for the city datum. */
export type ValleyOptions = Readonly<{
	seed: number;
	parameters?: Partial<ValleySettings>;
	wetWidth?: number;
	onTiming?: (timing: ValleyTiming) => void;
}>;

/** Position on the lower terrace in meters, with downstream bearing in radians. */
export type TerraceFrame = Readonly<{
	position: Vec3;
	bearing: number;
	downstream: Vec2;
	across: Vec2;
}>;

/** Frozen geometry in meters with Z up and downstream bearing in radians.
 * The 2 km grid is north-first with 12.5 m cells and named ground bands.
 */
export type Valley = Readonly<{
	seed: number;
	revision: typeof revision;
	parameters: ValleySettings;
	course: RiverCourse;
	reaches: readonly Reach[];
	lakes: readonly DrainageLake[];
	/** Checks the solved graph, uncarved dry triangles and spill elevations after incision. */
	checkDrainage(): DrainageCheck;
	/** Samples ground with the identity and kind of surface water, when present. */
	sampleTerrain: ReturnType<typeof terrainSampler>;
	grid: HeightGrid;
	bands: typeof valleyBands;
	/** Returns a frozen frame at the lower terrace center, at a signed downstream station
	 * in meters on the valley axis. Across points from the river toward the selected terrace.
	 * Defaults to the narrower side. Non-finite stations or stations outside ±500 m throw.
	 */
	lowerTerraceFrame(station: number, side?: 'narrow' | 'wide'): TerraceFrame;
	/** Samples bed elevation in meters at finite XY coordinates in the closed grid window. */
	heightAt(x: number, y: number): number;
	/** Reads bed, mean water and signed distance to the bank in true meters (capped at +160 m on land).
	 * Returns a detached sample. The closed solve covers ±6 km on both axes. Other coordinates throw RangeError.
	 */
	sampleGround(x: number, y: number): Readonly<{ height: number; water: number; bank: number }>;
	/** Reads height, water level, bank distance, slope (rise/run over up to 5 m)
	 * and cover (`dry`, `river` or `lake`) at finite XY meters anywhere in the regional reach.
	 * The one generic per-point ground query for plans that sit on the terrain. */
	readGround(x: number, y: number): GroundReading;
}>;

// Exact arithmetic: the exported generator identity stays fixed for bit-identical behavior.
const revision = /* Exact arithmetic: terrain revision recorded in saves. */ 4;
// Exact arithmetic: test both lateral directions, then step away from the nominal point.
const drySearchDirections = /* Exact arithmetic: search both directions from the water. */ [
	1, -1
] as const;

/** Builds one deterministic catchment and routes water from a seeded ancestral valley. */
function create({ seed, parameters, wetWidth, onTiming }: ValleyOptions): Valley {
	if (!Number.isInteger(seed) || seed < 0 || seed >= uint32Limit)
		throw new RangeError('invalid-seed');
	const resolved = resolveParams(valleyParams, parameters);
	const settings = Object.freeze({
		sinuosity: Number(resolved.sinuosity.toFixed(sinuosityRoundingDigits)),
		relief: Number(resolved.relief.toFixed(reliefRoundingDigits)),
		runoff: Number(resolved.runoff.toFixed(runoffRoundingDigits))
	});
	const root = Random.create({ seed });
	const openSide = root.derive('open-bank').number() < openBankPositiveSideProbability ? 1 : -1;
	const guide = generateCourse(
		root.derive('course'),
		settings.sinuosity,
		openSide,
		valleyFrameBearingRad
	);
	if (
		wetWidth !== undefined &&
		(!Number.isFinite(wetWidth) || wetWidth < minimumImportedWetWidthM || wetWidth > guide.wetWidth)
	)
		throw new RangeError('Wet width must fit inside the generated bankfull channel');
	const axis = createValleyAxis(root.derive('ground'), guide, openSide);
	const terrain = drainageTerrain(guide, axis, root, settings.relief, settings.runoff, wetWidth);
	const rasterStart = performance.now();
	const course = trunkCourse(terrain, guide.bearing);
	const sample = terrainSampler(terrain, settings.relief);
	let grid: HeightGrid | undefined;
	const readGrid = () => (grid ??= heightGrid(sample, axis));
	if (onTiming) {
		readGrid();
		onTiming(Object.freeze({ ...terrain.timing, gridMs: performance.now() - rasterStart }));
	}
	return Object.freeze({
		seed,
		revision,
		parameters: settings,
		course,
		lakes: terrain.lakes,
		checkDrainage: () => terrain.check((x, y) => sample(x, y).height),
		reaches: terrain.reaches,
		get grid() {
			return readGrid();
		},
		bands: valleyBands,
		sampleTerrain: sample,
		sampleGround(x: number, y: number) {
			const { height, water, bank } = sample(x, y);
			return { height, water, bank };
		},
		readGround: (x: number, y: number) => readGround(sample, x, y),
		lowerTerraceFrame(station: number, side: 'narrow' | 'wide' = 'narrow') {
			if (!Number.isFinite(station) || Math.abs(station) > terraceFrameStationLimitM)
				throw new RangeError('Terrace station is outside the central valley');
			if (side !== 'wide' && side !== 'narrow') throw new RangeError('Unknown terrace side');
			const sign = side === 'wide' ? axis.openSide : -axis.openSide;
			const edge =
				side === 'wide'
					? axis.openEdgeM + axis.wideningM * (station / axis.bowSpanM)
					: axis.closeEdgeM;
			const lateral = axisBow(axis, station) + sign * (edge + axis.profile.upperSetbackM / 2);
			const u = Math.cos(axis.bearingRad);
			const v = Math.sin(axis.bearingRad);
			let x = axis.anchorX + u * station - v * lateral;
			let y = axis.anchorY + v * station + u * lateral;
			for (
				let shift = terraceFrameDrySearchStepM;
				sample(x, y).bank <= 0 && shift <= terraceFrameDrySearchLimitM;
				shift += terraceFrameDrySearchStepM
			) {
				for (const direction of drySearchDirections) {
					const nextX = axis.anchorX + u * station - v * (lateral + direction * shift);
					const nextY = axis.anchorY + v * station + u * (lateral + direction * shift);
					if (sample(nextX, nextY).bank <= 0) continue;
					x = nextX;
					y = nextY;
					break;
				}
			}
			return Object.freeze({
				position: Object.freeze([x, y, sample(x, y).height] as const),
				bearing: axis.bearingRad,
				downstream: Object.freeze([u, v] as const),
				across: Object.freeze([-v * sign, u * sign] as const)
			});
		},
		heightAt(x: number, y: number) {
			const half = windowSize / 2;
			if (!(Math.abs(x) <= half && Math.abs(y) <= half)) throw new RangeError('outside-window');
			return sample(x, y).height;
		}
	});
}

/** Factory for the seeded large-lowland valley. */
export const Valley = Object.freeze({ create });
