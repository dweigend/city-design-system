import { defineSettings, settingValues } from '../setting';

/** Numeric settings for storey limits and lane access. */
export const settings = defineSettings({
	setbackStepStoreys: {
		value: 1,
		unit: 'storeys',
		meaning: 'Default vertical interval between horizontal setback steps',
		bounds: { min: 1 },
		rationale: 'A step at each storey gives a continuous stair profile at the selected cell depth.'
	},
	eavesToleranceStoreys: {
		value: 1,
		unit: 'storeys',
		meaning:
			'Largest seeded drop of a calm house below the block height; frontage cells share that eaves line',
		bounds: { min: 0 },
		principle: 'FORM-2',
		rationale: 'A row of houses reads as one street front when eaves differ by at most a storey.'
	},
	cornerRiseStoreys: {
		value: 1,
		unit: 'storeys',
		meaning: 'Storeys a calm house on a block corner rises above the eaves line',
		bounds: { min: 0 },
		principle: 'FORM-2'
	},
	largeStoreys: {
		value: 2,
		unit: 'storeys',
		meaning: 'Storeys of a large building below its roof figure',
		bounds: { min: 1 },
		principle: 'FORM-1'
	},
	entranceStepRiseM: {
		value: 0.15,
		unit: 'm',
		meaning:
			'Rise from the lane to the ground storey above which the entrance takes steps inside its cell',
		bounds: { min: 0 },
		principle: 'COLOR-3',
		rationale: 'One kerb height; below it a sill suffices.'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
