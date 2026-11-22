import { VALLEY_PICTURE_BEARING_RAD } from '../data/valley-references';
import { generateValley, sampleValley, type ValleyField } from '../logic/valley';

export const VALLEY_STUDY_GRID = { windowM: 2000, spacingM: 12.5 } as const;
export const VALLEY_STUDY_VIEW = {
	exaggeration: 4,
	elevationRad: (33 * Math.PI) / 180,
	margin: 1.03,
	heightRangeM: [-4, 22]
} as const;
export const VALLEY_STUDY_SCALE_M = 500;

/** Samples a rigidly rotated seed in the common study frame, with mean flow from top to bottom. */
export function valleyStudyField(seed: number): ValleyField {
	const valley = generateValley({ seed, bearingRad: VALLEY_PICTURE_BEARING_RAD });
	return sampleValley(valley, VALLEY_STUDY_GRID);
}
