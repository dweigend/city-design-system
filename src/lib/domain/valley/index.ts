import type { Vec2, Vec3 } from '../../core/geometry';
import { Random } from '../../core/random';
import { resolveParams } from '../../core/params';
import { generateCourse, type RiverCourse } from './course';
import { groundSampler, heightGrid, valleyBands, type HeightGrid } from './ground';
import { valleyParams } from './parameters';
import { axisBow } from './ground-profile';
import { createValleyAxis } from './valley-axis';

/** Public numeric controls and their units and bounds. */
export { valleyParams } from './parameters';
/** Index order for named ground bands on the raster. */
export { valleyBands } from './ground';
export type { HeightGrid, RiverCourse };

/** Seed and optional nominal sinuosity. The chapter defaults to seed 1201. */
export type ValleyOptions = Readonly<{
	seed: number;
	parameters?: Readonly<{ sinuosity?: number }>;
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
	parameters: Readonly<{ sinuosity: number }>;
	course: RiverCourse;
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
}>;

/** Builds one deterministic river and its ground from a uint32 seed and a nominal
 * sinuosity (default 1.15). The input clamps to [1.04, 1.28] and snaps to 0.01. At a fixed
 * parameter, the paired curvature draw adds −0.011 to +0.027 to the full-wave ratio.
 * Sinuosity means channel length divided by endpoint chord over a full wavelength.
 * Keyed course, bank and ground streams produce repeatable results. Invalid seeds or
 * parameter overrides throw. The independent measurement protocol lives in world/valley-protocol.
 */
function create({ seed, parameters }: ValleyOptions): Valley {
	if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) throw new RangeError('invalid-seed');
	const { sinuosity } = resolveParams(valleyParams, parameters);
	const settings = Object.freeze({ sinuosity: Number(sinuosity.toFixed(2)) });
	const root = Random.create({ seed });
	const openSide = root.derive('open-bank').number() < 0.5 ? 1 : -1;
	const course = generateCourse(root.derive('course'), settings.sinuosity, openSide, -Math.PI / 2);
	const axis = createValleyAxis(root.derive('ground'), course, openSide);
	const sample = groundSampler(course, axis, root.derive('regional'));
	const grid = heightGrid(sample, axis);
	return Object.freeze({
		seed,
		parameters: settings,
		course,
		grid,
		bands: valleyBands,
		sampleGround: sample,
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
