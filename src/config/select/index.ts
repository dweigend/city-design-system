import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	selectOffsetPx: {
		value: 4,
		unit: 'CSS px',
		meaning: 'Gap between the options menu and its trigger',
		rationale: 'Separates the options from the selected value.'
	}
});

export const defaults = settingValues(settings);
