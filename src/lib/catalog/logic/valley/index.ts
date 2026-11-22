import { clipPolylineToSquare, sinuosity } from '../../core/polyline';
import {
	LARGE_LOWLAND_MEASUREMENT_BANDS,
	VALLEY_MEASUREMENT_PROTOCOL
} from '../../data/valley-references';
import type { ValleyGroundProfile } from '../../data/valley-ground';
import { resolveGroundProfile } from './ground-parameters';
import { createValleyAxis } from './valley-axis';
import { generateCourse, type RiverCourse } from './course';
import { valleyParameters, type ValleyParameters } from './parameters';
import type { Valley } from './snapshot';

export type { RiverCourse, ValleyGroundProfile, ValleyParameters, Valley };
export { sampleValley, type ValleyField } from './field';
export { contains, groundAt, meanWaterAt } from './field-samplers';
export { DEFAULT_VALLEY_PARAMETERS } from './parameters';

export type ValleyOptions = Readonly<{
	seed: number;
	bearingRad?: number;
	parameters?: Partial<ValleyParameters>;
	groundProfile?: Partial<ValleyGroundProfile>;
}>;

const TRIBUTARIES = Object.freeze([] as const);
const SEED_LIMIT = 2 ** 32;

/**
 * Generates a large-lowland valley course from a u32 seed and optional parameter
 * overrides in meters, radians and width ratios. Optional ground profile values replace
 * the authored defaults. An optional bearing selects the sampling frame before the
 * sinuosity check. Defaults and override bounds are in CONTRACT.md. The frozen result has
 * caller-owned XY and chainage buffers in downstream order at 6.25 m spacing.
 * Throws RangeError for invalid inputs or a checked course outside the local sinuosity band.
 */
export function generateValley({
	seed,
	parameters,
	bearingRad,
	groundProfile
}: ValleyOptions): Valley {
	if (!Number.isInteger(seed) || seed < 0 || seed >= SEED_LIMIT) {
		throw new RangeError('invalid-seed');
	}
	if (bearingRad !== undefined && !Number.isFinite(bearingRad))
		throw new RangeError('invalid-bearing');
	const normalizedSeed = seed >>> 0;
	const resolved = valleyParameters(parameters);
	const profile = resolveGroundProfile(groundProfile);
	const course = generateCourse(normalizedSeed, resolved, bearingRad);
	if (parameters || bearingRad !== undefined) checkLocalSinuosity(course);
	const axis = createValleyAxis(normalizedSeed, course, resolved, profile);
	return Object.freeze({
		version: 'valley/5',
		seed: normalizedSeed,
		course,
		axis,
		floors: axis.floors,
		tributaries: TRIBUTARIES,
		valleySlope: profile.valleySlope
	});
}

function checkLocalSinuosity(course: RiverCourse): void {
	const reach = clipPolylineToSquare(course.xy, VALLEY_MEASUREMENT_PROTOCOL.localWindowM);
	if (!reach || sinuosity(reach.xy) > LARGE_LOWLAND_MEASUREMENT_BANDS.sinuosity2km[1]) {
		throw new RangeError('valley-sinuosity-out-of-band');
	}
}
