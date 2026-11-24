import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	randomDefaultSeed: {
		value: 1,
		unit: 'seed',
		meaning: 'Seed of a random stream created without an explicit seed',
		rationale: 'Keeps unseeded calls reproducible and preserves the original default stream.'
	}
});

export const defaults = settingValues(settings);
