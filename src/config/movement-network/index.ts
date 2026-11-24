import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	accessWidthMinM: {
		value: 1,
		unit: 'm',
		meaning: 'Minimum clear width of an access object',
		rationale: 'Bound the dimensions of a single placeable object'
	},
	accessWidthMaxM: {
		value: 8,
		unit: 'm',
		meaning: 'Maximum width of a single access ribbon',
		rationale: 'Bound the dimensions of a single placeable object'
	},
	accessWidthStepM: {
		value: 0.1,
		unit: 'm',
		meaning: 'Editing increment for access width',
		rationale: 'Bound the dimensions of a single placeable object'
	},
	walkwayWidthM: {
		value: 3.2,
		unit: 'm',
		meaning: 'Width of the elevated walking ribbon',
		principle: 'CITY-5'
	},
	deckThicknessM: {
		value: 0.55,
		unit: 'm',
		meaning: 'Thickness of pedestrian deck slabs',
		principle: 'CITY-5'
	},
	walkwayPierRadiusM: {
		value: 0.45,
		unit: 'm',
		meaning: 'Radius of a pedestrian bearing column',
		principle: 'CITY-5'
	},
	stairWidthM: {
		value: 1.6,
		unit: 'm',
		meaning: 'Width of one flight in a switchback',
		rationale: 'Two-way pedestrian access'
	},
	stairRiseM: {
		value: 0.18,
		unit: 'm',
		meaning: 'Maximum stair riser height',
		rationale: 'Draw walkable treads'
	}
});

export const defaults = settingValues(settings);
