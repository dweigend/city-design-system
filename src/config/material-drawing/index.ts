import { defineSettings, settingValues } from '../setting';

const positive = { exclusiveMin: 0 } as const;
const share = { min: 0, max: 1 } as const;

export const settings = defineSettings({
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
	corkGrainLightness: {
		value: 0.09,
		unit: 'Oklab L',
		meaning: 'Lightness swing of the fine even grain of cork',
		bounds: { min: 0 },
		principle: 'MAT-8'
	},
	cardGrainLightness: {
		value: 0.035,
		unit: 'Oklab L',
		meaning: 'Lightness swing of the fibre of card, grey board and the abstract ground',
		bounds: { min: 0 },
		principle: 'MAT-8'
	},
	functionColourDistance: {
		value: 0.08,
		unit: 'Oklab ΔE',
		meaning: 'Least distance of every model tone from every flow colour, in both themes',
		bounds: { exclusiveMin: 0 },
		principle: 'MAT-11'
	},
	grainCellM: {
		value: 0.06,
		unit: 'm',
		meaning: 'Size of one grain speck in world meters',
		bounds: { exclusiveMin: 0 },
		principle: 'MAT-8'
	}
});

export const defaults = settingValues(settings);
