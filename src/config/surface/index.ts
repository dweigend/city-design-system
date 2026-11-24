import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	cityHeightScaleM: {
		value: 140,
		unit: 'm',
		meaning: 'Upper tick of the city column height ramp',
		rationale: 'Preserves the distance covered by the city height palette.'
	}
});

export const defaults = settingValues(settings);
