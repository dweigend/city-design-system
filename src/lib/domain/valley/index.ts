import type { Vec2, Vec3 } from '../../core/geometry';
import { Random } from '../../core/random';
import { resolveParams } from '../../core/params';
import { generateCourse, type RiverCourse } from './course';
import { groundSampler, heightGrid, valleyBands, type HeightGrid } from './ground';
import { valleyParams } from './parameters';
import { drawLake, lakeReach, type Lake } from './lake';
import { mountainFlanks } from './relief';
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

/** Public numeric controls and their units and bounds. */
export { valleyParams, valleyLakeModes } from './parameters';
/** Peak height in meters of the tallest massif for a relief ratio. */
export { peakHeightM } from './relief';
/** Index order for named ground bands on the raster. */
export { valleyBands } from './ground';
export type {
	GroundReading,
	GroundSurvey,
	HydrologyFaults,
	HeightGrid,
	Lake,
	RiverCourse,
	SurveyWindow
};
/** Default survey window: 4 km square, 20 m spacing, buildable below a 20 % slope. */
export { surveyDefaults } from './survey';

/** Measures a valley in a square window around its center: lowest, highest and relief in
 * meters, steepest node slope, water share, lake area in m², the share of dry nodes below the
 * buildable slope, and hydrology faults (all zero when sound). Pure; samples each node once.
 * Invalid windows throw RangeError. */
export function surveyValley(valley: Valley, window: SurveyWindow = surveyDefaults): GroundSurvey {
	return surveyGround(valley.sampleGround, valley.lake, valley.course.xy, window);
}

/** Resolved parameters: sinuosity ratio, relief ratio in [0, 1] and lake mode index into
 * valleyLakeModes. */
export type ValleySettings = Readonly<{ sinuosity: number; relief: number; lake: number }>;

/** Seed and optional parameters. The chapter defaults to seed 1201. */
export type ValleyOptions = Readonly<{
	seed: number;
	parameters?: Partial<ValleySettings>;
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
	parameters: ValleySettings;
	course: RiverCourse;
	/** The lake on the river, or null. Its water is flat at `level`. */
	lake: Lake | null;
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
	 * Returns a detached sample. Non-finite or out-of-range coordinates throw RangeError.
	 */
	sampleGround(x: number, y: number): Readonly<{ height: number; water: number; bank: number }>;
	/** Reads height, water level, bank distance, slope (rise/run over a 5 m central difference)
	 * and cover (`dry`, `river` or `lake`) at finite XY meters anywhere in the regional reach.
	 * The one generic per-point ground query for plans that sit on the terrain. */
	readGround(x: number, y: number): GroundReading;
}>;

/** Builds one deterministic river and its ground from a uint32 seed and three parameters.
 * Sinuosity (default 1.15) clamps to [1.04, 1.28] and snaps to 0.01. At a fixed
 * parameter, the paired curvature draw adds −0.011 to +0.027 to the full-wave ratio.
 * Sinuosity means channel length divided by endpoint chord over a full wavelength.
 * Relief (default 0, step 0.05) raises seeded mountain massifs beyond the upper terrace, up to
 * peakHeightM(relief) above the water; zero keeps the lowland valley unchanged. Lake (default 1)
 * selects never, seeded (chance 0.6 × relief) or always; a lake widens the river into a flat
 * ellipse and the river keeps falling downstream of it. Keyed course, bank, ground, relief and
 * lake streams produce repeatable results. Invalid seeds or parameter overrides throw. The
 * independent measurement protocol lives in world/valley-protocol.
 */
function create({ seed, parameters }: ValleyOptions): Valley {
	if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) throw new RangeError('invalid-seed');
	const { sinuosity, relief, lake: lakeMode } = resolveParams(valleyParams, parameters);
	const settings = Object.freeze({
		sinuosity: Number(sinuosity.toFixed(2)),
		relief: Number(relief.toFixed(2)),
		lake: lakeMode
	});
	const root = Random.create({ seed });
	const openSide = root.derive('open-bank').number() < 0.5 ? 1 : -1;
	const course = generateCourse(root.derive('course'), settings.sinuosity, openSide, -Math.PI / 2);
	const axis = createValleyAxis(root.derive('ground'), course, openSide);
	const flanks = mountainFlanks(root.derive('relief'), settings.relief);
	const shape = drawLake(root.derive('lake'), course, axis.bearingRad, settings.relief, lakeMode);
	const reach = shape && lakeReach(shape, axis.bearingRad);
	const sample = groundSampler(course, axis, root.derive('regional'), {
		flanks,
		lake: shape,
		lakeReach: reach
	});
	const grid = heightGrid(sample, axis);
	const lake = shape && Object.freeze({ ...shape, level: sample(...shape.center).water });
	return Object.freeze({
		seed,
		parameters: settings,
		course,
		lake,
		grid,
		bands: valleyBands,
		sampleGround: sample,
		readGround: (x: number, y: number) => readGround(sample, lake, x, y),
		lowerTerraceFrame(station: number, side: 'narrow' | 'wide' = 'narrow') {
			if (!Number.isFinite(station) || Math.abs(station) > 500)
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
			const x = axis.anchorX + u * station - v * lateral;
			const y = axis.anchorY + v * station + u * lateral;
			return Object.freeze({
				position: Object.freeze([x, y, sample(x, y).height] as const),
				bearing: axis.bearingRad,
				downstream: Object.freeze([u, v] as const),
				across: Object.freeze([-v * sign, u * sign] as const)
			});
		},
		heightAt(x: number, y: number) {
			const half = grid.origin[1];
			if (!(Math.abs(x) <= half && Math.abs(y) <= half)) throw new RangeError('outside-window');
			return sample(x, y).height;
		}
	});
}

/** Factory for the seeded large-lowland valley. */
export const Valley = Object.freeze({ create });
