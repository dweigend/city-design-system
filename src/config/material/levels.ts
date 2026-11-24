/** What each surface level draws (MAT-5), from most to least detail. `marks` prints every
 * pattern, only large graphic ones (pitch at least `farMarkPitchM`) or none; `openings` cuts and
 * shows openings; `joints` draws panel hairlines; `grain` lets cork and card show their grain;
 * `accents` keeps the small accent primitives of a house; `parts` keeps a house's parts beyond its
 * bodies (rims, openings, stairs, planting, roof tone). `plain` is the default of every house: its
 * bodies in one matte tone; salience grants more detail (MAT-15). */
// Exact arithmetic: switches of a data table, not tunables.
export const surfaceLevelTable = Object.freeze({
	near: Object.freeze({
		marks: 'all',
		openings: true,
		joints: true,
		grain: true,
		accents: true,
		parts: true
	}),
	mid: Object.freeze({
		marks: 'none',
		openings: true,
		joints: false,
		grain: false,
		accents: false,
		parts: true
	}),
	far: Object.freeze({
		marks: 'graphic',
		openings: false,
		joints: false,
		grain: false,
		accents: false,
		parts: true
	}),
	plain: Object.freeze({
		marks: 'none',
		openings: false,
		joints: false,
		grain: false,
		accents: false,
		parts: false
	}),
	pencil: Object.freeze({
		marks: 'none',
		openings: true,
		joints: true,
		grain: false,
		accents: false,
		parts: true
	})
} as const);
