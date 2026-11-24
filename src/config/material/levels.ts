/** What each surface level draws (MAT-5): `marks` prints every pattern, only large graphic ones
 * (pitch at least `farMarkPitchM`) or none; `openings` cuts and shows openings; `joints` draws
 * panel hairlines; `grain` lets cork and card show their fine grain; `accents` keeps the small
 * accent primitives of a house. The far level is a plain matte body in its body tone. */
// Exact arithmetic: switches of a data table, not tunables.
export const surfaceLevelTable = Object.freeze({
	near: Object.freeze({ marks: 'all', openings: true, joints: true, grain: true, accents: true }),
	mid: Object.freeze({ marks: 'all', openings: true, joints: false, grain: false, accents: true }),
	far: Object.freeze({
		marks: 'graphic',
		openings: false,
		joints: false,
		grain: false,
		accents: false
	}),
	pencil: Object.freeze({
		marks: 'none',
		openings: true,
		joints: true,
		grain: false,
		accents: false
	})
} as const);
