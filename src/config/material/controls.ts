import { defineSettings } from '../setting';

const positive = { exclusiveMin: 0 } as const;
const share = { min: 0, max: 1 } as const;

/** Player control bands and the pencil level. */
export const controls = defineSettings({
	moduleScaleBand: {
		value: [0.5, 2, 0.25],
		unit: 'ratio',
		meaning: 'Lowest, highest and step of the module scale a player may choose',
		bounds: positive,
		rationale: 'From half to double the configured module keeps every family recognisable.'
	},
	reliefScaleBand: {
		value: [0, 2, 0.25],
		unit: 'ratio',
		meaning: 'Lowest, highest and step of the relief scale a player may choose',
		bounds: { min: 0 },
		rationale: 'Zero flattens the relief; double shows it at long distance.'
	},
	seedBand: {
		value: [1, 64, 1],
		unit: 'seed',
		meaning: 'Lowest, highest and step of the variation seed offered on the page',
		bounds: { min: 0 },
		rationale: 'A short range is enough to compare variations.'
	},
	pencilHatchRatio: {
		value: 0.6,
		unit: 'ratio',
		meaning: 'Hatching strength on shaded faces at the pencil level',
		bounds: share,
		principle: 'COLOR-5'
	},
	pencilStrokeWidthPx: {
		value: 0.8,
		unit: 'CSS px',
		meaning: 'Width of the joint lines drawn at the pencil level',
		bounds: positive,
		principle: 'MAT-6'
	},
	pencilStrokeOpacityRatio: {
		value: 0.55,
		unit: 'ratio',
		meaning: 'Opacity of the joint lines drawn at the pencil level',
		bounds: share,
		principle: 'MAT-6'
	},
	pencilLiftM: {
		value: 0.004,
		unit: 'm',
		meaning: 'Offset of pencil joint lines in front of the flat face',
		bounds: positive,
		rationale: 'Keeps the lines from flickering into the face they sit on.'
	}
});
