import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	storyValleySeed: {
		value: 1201,
		unit: 'seed',
		meaning: 'Fixed seed of the story valley and city carrier',
		principle: 'CITY-11'
	},
	storyCarrierSizeM: {
		value: 800,
		unit: 'm',
		meaning: 'City selection that supplies the river crossing and its dry cells',
		principle: 'CITY-11'
	},
	storyBuildingsByEvent: {
		value: [3, 8, 15],
		unit: 'count',
		meaning: 'Cumulative buildings at settlement, crossing and infill',
		principle: 'GROW-1'
	},
	storyWindowMarginM: {
		value: 48,
		unit: 'm',
		meaning: 'Ground margin around the final cluster and bridge',
		principle: 'GROW-2'
	},
	storyBodyRadiusShare: {
		value: 0.84,
		unit: 'ratio',
		meaning: 'Share of the largest inscribed square available to a building',
		principle: 'CITY-3'
	},
	storyUpperWidthShare: {
		value: 0.8,
		unit: 'ratio',
		meaning: 'Width of a new upper storey relative to its retained base',
		principle: 'GROW-3'
	},
	storyHallStoreys: {
		value: 3,
		unit: 'count',
		meaning: 'Number of storeys added above the riverside hall at handover',
		principle: 'GROW-4'
	}
});

export const defaults = settingValues(settings);
