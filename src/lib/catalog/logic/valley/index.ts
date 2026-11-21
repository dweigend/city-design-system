import { generateCourse, type RiverCourse } from './course';
import { valleyParameters, type ValleyParameters } from './parameters';

export type { RiverCourse, ValleyParameters };
export { DEFAULT_VALLEY_PARAMETERS } from './parameters';

export type ValleyOptions = Readonly<{
	seed: number;
	parameters?: Partial<ValleyParameters>;
}>;

export type Valley = Readonly<{
	version: 'valley/2';
	seed: number;
	course: RiverCourse;
}>;

const SEED_LIMIT = 2 ** 32;

/**
 * Generates a large-lowland valley course from a u32 seed and optional parameter
 * overrides in meters, radians and width ratios. Defaults and override bounds are in
 * CONTRACT.md. The result is frozen and detached, with caller-owned XY and chainage
 * buffers in downstream order at 6.25 m spacing. Leaves the options untouched.
 * Throws RangeError before allocation for an invalid seed or parameter.
 */
export function generateValley({ seed, parameters }: ValleyOptions): Valley {
	if (!Number.isInteger(seed) || seed < 0 || seed >= SEED_LIMIT) {
		throw new RangeError('invalid-seed');
	}
	const normalizedSeed = seed >>> 0;
	const course = generateCourse(normalizedSeed, valleyParameters(parameters));
	return Object.freeze({ version: 'valley/2', seed: normalizedSeed, course });
}
