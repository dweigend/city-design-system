import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	registeredPierRadiusMinM: {
		value: 0.4,
		unit: 'm',
		meaning: 'Minimum radius of a single guideway pier',
		rationale: 'Bound the dimensions of a single placeable object'
	},
	registeredPierRadiusMaxM: {
		value: 2,
		unit: 'm',
		meaning: 'Maximum radius of a single guideway pier',
		rationale: 'Bound the dimensions of a single placeable object'
	},
	registeredPierRadiusStepM: {
		value: 0.1,
		unit: 'm',
		meaning: 'Editing increment for pier radius',
		rationale: 'Bound the dimensions of a single placeable object'
	},
	registeredPlatformWidthMinM: {
		value: 6,
		unit: 'm',
		meaning: 'Minimum width of a platform with paired shelters',
		rationale: 'Bound the dimensions of a single placeable object'
	},
	registeredPlatformWidthMaxM: {
		value: 20,
		unit: 'm',
		meaning: 'Maximum width of a platform with paired shelters',
		rationale: 'Bound the dimensions of a single placeable object'
	},
	registeredPlatformWidthStepM: {
		value: 1,
		unit: 'm',
		meaning: 'Editing increment for platform width',
		rationale: 'Bound the dimensions of a single placeable object'
	},
	railPierRadiusM: {
		value: 0.8,
		unit: 'm',
		meaning: 'Radius of a guideway pier',
		rationale: 'Carry the rail and its transverse bearing beam'
	},
	railDeckThicknessM: {
		value: 0.9,
		unit: 'm',
		meaning: 'Thickness of the rail deck and transverse cap',
		rationale: 'Separate the platform surface and bearing'
	},
	platformLengthM: {
		value: 60,
		unit: 'm',
		meaning: 'Length of station platform',
		rationale: 'One short train'
	},
	platformWidthM: {
		value: 13,
		unit: 'm',
		meaning: 'Full station platform width',
		rationale: 'Room for docking on either side'
	},
	canopyHeightM: {
		value: 3.3,
		unit: 'm',
		meaning: 'Underside of the station shelter above the platform',
		rationale: 'Make the station identifiable in elevation'
	},
	stationCanopyLengthShare: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Share of platform length covered by the shelter',
		rationale: 'Leave both ends of the platform open'
	},
	platformSlabThicknessM: {
		value: 0.55,
		unit: 'm',
		meaning: 'Thickness of the platform and shelter slabs',
		rationale: 'Keep the station slabs visible at the scale of the guideway'
	},
	canopyPostRadiusM: {
		value: 0.45,
		unit: 'm',
		meaning: 'Radius of a station shelter column',
		rationale: 'Carry the shelter while leaving its edges open'
	},
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
