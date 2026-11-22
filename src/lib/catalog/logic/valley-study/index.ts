import { VALLEY_PICTURE_BEARING_RAD } from '../../data/valley-references';
import { generateValley, sampleValley, type ValleyField } from '../valley';

export const VALLEY_STUDY_GRID = { windowM: 2000, spacingM: 12.5 } as const;
export const VALLEY_STUDY_VIEW = {
	exaggeration: 4,
	elevationRad: (33 * Math.PI) / 180,
	margin: 1.03,
	heightRangeM: [-4, 22]
} as const;
export const VALLEY_STUDY_SCALE_M = 500;

/** Generates a detached valley for the common study bearing in radians.
 * Accepts an unsigned 32-bit seed. Validation and draw order follow generateValley.
 */
export function valleyStudySnapshot(seed: number) {
	return generateValley({ seed, bearingRad: VALLEY_PICTURE_BEARING_RAD });
}

/** Samples the common study grid in meters with flow toward the bottom.
 * Accepts an unsigned 32-bit seed and returns a field with fresh buffers.
 * Invalid seeds propagate the generator's RangeError.
 */
export function valleyStudyField(seed: number): ValleyField {
	return sampleValley(valleyStudySnapshot(seed), VALLEY_STUDY_GRID);
}
