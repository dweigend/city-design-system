import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	maximumGradeRatio: {
		value: 0.04,
		unit: 'm/m',
		meaning: 'Maximum centerline rise over horizontal run',
		rationale: 'Conservative rail gradient limit'
	},
	minimumRadiusM: {
		value: 180,
		unit: 'm',
		meaning: 'Minimum horizontal curve radius',
		rationale: 'Keep city rail curves broad'
	},
	railClearanceM: {
		value: 7,
		unit: 'm',
		meaning: 'Track elevation above terrain, water or an obstructing roof',
		rationale: 'Allow a deck and clear space below'
	},
	surveyStepM: {
		value: 8,
		unit: 'm',
		meaning: 'Maximum centerline terrain sampling interval',
		rationale: 'Resolve lowland shorelines and short ridges'
	},
	pierIntervalM: {
		value: 60,
		unit: 'm',
		meaning: 'Nominal interval between rail bearings',
		rationale: 'Use a small set of repeated spans'
	},
	pierSearchM: {
		value: 42,
		unit: 'm',
		meaning: 'Maximum lateral reach of a pier head',
		principle: 'CITY-4'
	},
	pierDryClearanceM: {
		value: 2,
		unit: 'm',
		meaning: 'Pier center setback from wet ground',
		rationale: 'Keep the pier footprint dry'
	},
	stationMarginM: {
		value: 32,
		unit: 'm',
		meaning: 'Minimum distance of stations from track ends',
		rationale: 'Leave room for the platform'
	}
});

export const defaults = settingValues(settings);
