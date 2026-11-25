/** The tones of the model palette (MAT-11): warm neutrals, saturated matte solids, a signal pair
 * for accents and the flat roof tone. */
export const modelTones = Object.freeze([
	'white',
	'cream',
	'chocolate',
	'grey',
	'cork',
	'blue',
	'yellow',
	'pink',
	'orange',
	'red',
	'roof',
	'lawn',
	'canopy'
] as const);
/** One tone of the model palette. */
export type ModelTone = (typeof modelTones)[number];
