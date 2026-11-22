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

/** Samples an off-channel window in the common study frame, with flow toward the bottom. */
export function valleyStudyField(seed: number): ValleyField {
	const valley = generateValley({ seed, bearingRad: VALLEY_PICTURE_BEARING_RAD });
	return sampleValley(valley, VALLEY_STUDY_GRID);
}
