import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	sliderValueFractionDigits: {
		value: 6,
		unit: 'decimal digits',
		meaning: 'Maximum visible decimal places in slider values',
		rationale: 'Shows fine increments while suppressing floating-point tails.'
	}
});

export const defaults = settingValues(settings);
