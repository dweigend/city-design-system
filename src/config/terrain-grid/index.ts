import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	outlineReachM: {
		value: 4000,
		unit: 'm',
		meaning: 'Default maximum outline distance from the datum',
		rationale: 'Preserves the supported extent of a terrain grid site.'
	}
});

export const defaults = settingValues(settings);
