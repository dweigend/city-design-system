import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	promenadeWidthM: {
		value: 6,
		unit: 'm',
		meaning: 'Full width of a shore promenade.',
		principle: 'CITY-4',
		bounds: { exclusiveMin: 0 }
	},
	mainWidthM: {
		value: 5,
		unit: 'm',
		meaning: 'Full width of a main lane.',
		principle: 'CITY-4',
		bounds: { exclusiveMin: 0 }
	},
	localWidthM: {
		value: 3,
		unit: 'm',
		meaning: 'Full width of a local walking lane.',
		principle: 'CITY-4',
		bounds: { exclusiveMin: 0 }
	},
	localStairWidthM: {
		value: 2.4,
		unit: 'm',
		meaning: 'Full width of a local stair lane.',
		principle: 'CITY-4',
		bounds: { exclusiveMin: 0 }
	},
	stairGradeRatio: {
		value: 0.1,
		unit: 'ratio',
		meaning: 'Longitudinal grade above which a lane uses stairs.',
		principle: 'CITY-4',
		bounds: { exclusiveMin: 0 }
	},
	gradeProbeStepM: {
		value: 6,
		unit: 'm',
		meaning: 'Maximum spacing between samples of longitudinal walking grade.',
		principle: 'CITY-4',
		bounds: { exclusiveMin: 0 }
	},
	promenadeDetourM: {
		value: 160,
		unit: 'm',
		meaning: 'Longest inland edge path to close a gap between adjacent shore chains.',
		principle: 'CITY-4',
		bounds: { exclusiveMin: 0 }
	},
	promenadeReachM: {
		value: 90,
		unit: 'm',
		meaning: 'Maximum clearance from water along a promenade detour.',
		principle: 'CITY-4',
		bounds: { exclusiveMin: 0 }
	},
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
