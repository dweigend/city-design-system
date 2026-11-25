import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	tabNumberDigits: {
		value: 2,
		unit: 'decimal digits',
		meaning: 'Minimum digit count of visible tab numbers',
		rationale: 'Aligns single- and double-digit tab numbers.'
	}
});

export const defaults = settingValues(settings);
