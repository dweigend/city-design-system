import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	detachedTargetM2: {
		value: 450,
		unit: 'm²',
		meaning: 'Target area of a detached holding.',
		principle: 'CITY-15',
		bounds: { exclusiveMin: 0 }
	},
	perimeterTargetM2: {
		value: 320,
		unit: 'm²',
		meaning: 'Target area of a perimeter holding.',
		principle: 'CITY-15',
		bounds: { exclusiveMin: 0 }
	},
	centerTargetM2: {
		value: 1500,
		unit: 'm²',
		meaning: 'Target area of a center holding.',
		principle: 'CITY-15',
		bounds: { exclusiveMin: 0 }
	},
	detachedMinimumM2: {
		value: 180,
		unit: 'm²',
		meaning: 'Smallest child in a detached frontage split.',
		principle: 'CITY-15',
		bounds: { exclusiveMin: 0 }
	},
	perimeterMinimumM2: {
		value: 100,
		unit: 'm²',
		meaning: 'Smallest child in a perimeter frontage split.',
		principle: 'CITY-15',
		bounds: { exclusiveMin: 0 }
	},
	centerMinimumM2: {
		value: 500,
		unit: 'm²',
		meaning: 'Smallest child in a center frontage split.',
		principle: 'CITY-15',
		bounds: { exclusiveMin: 0 }
	},
	minimumFrontageM: {
		value: 3,
		unit: 'm',
		meaning: 'Minimum uninterrupted lane contact for a holding entrance.',
		principle: 'CITY-15',
		bounds: { exclusiveMin: 0 }
	},
	courtInsetM: {
		value: 12,
		unit: 'm',
		meaning: 'Inward offset for a public perimeter court.',
		principle: 'CITY-15',
		bounds: { exclusiveMin: 0 }
	},
	passageWidthM: {
		value: 3,
		unit: 'm',
		meaning: 'Clear width of a public court entrance.',
		principle: 'CITY-4',
		bounds: { exclusiveMin: 0 }
	},
	mergeShareRatio: {
		value: 0.08,
		unit: 'ratio',
		meaning: 'Ceiling on merged pair area as a share of eligible ground.',
		principle: 'CITY-16',
		bounds: { min: 0, max: 1 }
	},
	mergeGradeRatio: {
		value: 0.1,
		unit: 'ratio',
		meaning: 'Maximum grade on either member perimeter of a merged pair.',
		principle: 'CITY-16',
		bounds: { min: 0, max: 1 }
	},
	linearToleranceM: {
		value: 0.000001,
		unit: 'm',
		meaning: 'Contact tolerance for independently constructed plan segments.',
		rationale: 'Allows roundoff in polygon intersections at the city extent.',
		bounds: { exclusiveMin: 0 }
	},
	areaToleranceM2: {
		value: 0.01,
		unit: 'm²',
		meaning: 'Absolute floor of block accounting tolerance.',
		rationale: 'A square decimeter is below the scale of any plan feature.',
		bounds: { exclusiveMin: 0 }
	},
	relativeAreaToleranceRatio: {
		value: 1e-8,
		unit: 'ratio',
		meaning: 'Area accounting tolerance relative to gross dry area.',
		rationale: 'Scales the area error bound for unusually large input blocks.',
		bounds: { exclusiveMin: 0 }
	}
});

export const parcelSettings = settingValues(settings);
