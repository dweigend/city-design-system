import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	guideScaleM: {
		value: 60,
		unit: 'm',
		meaning: 'Guide distance that doubles the level-ground cost of a main lane edge.',
		principle: 'CITY-13',
		bounds: { exclusiveMin: 0 }
	},
	gradeWeightRatio: {
		value: 4,
		unit: 'ratio',
		meaning: 'Cost multiplier applied to the absolute grade of each routed edge.',
		principle: 'CITY-13',
		bounds: { min: 0 }
	},
	guideSearchM: {
		value: 120,
		unit: 'm',
		meaning: 'Maximum lateral distance from an arm guide to a routed edge midpoint.',
		rationale: 'Allows detours of multiple block widths while bounding each local search.',
		bounds: { exclusiveMin: 0 }
	}
});

export const laneSettings = settingValues(settings);
