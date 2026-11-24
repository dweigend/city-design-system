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
	shadeLightness: {
		value: -0.17,
		unit: 'Oklab L',
		meaning: 'Lightness offset of cast shade from the face it falls on',
		bounds: { max: 0 },
		principle: 'MAT-2'
	}
});

export const defaults = settingValues(settings);
