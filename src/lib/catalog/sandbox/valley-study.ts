import { generateValley, sampleValley, type ValleyField } from '../logic/valley';

export const VALLEY_STUDY_GRID = { windowM: 2000, spacingM: 12.5 } as const;
export const VALLEY_STUDY_VIEW = {
	exaggeration: 4,
	elevationRad: (33 * Math.PI) / 180,
	margin: 1.03,
	heightRangeM: [-4, 18]
} as const;
export const VALLEY_STUDY_SCALE_M = 500;

/** Samples a rigidly rotated seed in the common study frame, with mean flow from top to bottom. */
export function valleyStudyField(seed: number): ValleyField {
	const valley = generateValley({ seed });
	const { course } = valley;
	const meanBearingRad = -Math.PI / 2;
	const rotation = meanBearingRad - course.meanBearingRad;
	const cos = Math.cos(rotation);
	const sin = Math.sin(rotation);
	const xy = new Float64Array(course.xy.length);
	for (let i = 0; i < xy.length; i += 2) {
		const x = course.xy[i];
		const y = course.xy[i + 1];
		xy[i] = x * cos - y * sin;
		xy[i + 1] = x * sin + y * cos;
	}
	return sampleValley({ ...valley, course: { ...course, xy, meanBearingRad } }, VALLEY_STUDY_GRID);
}
