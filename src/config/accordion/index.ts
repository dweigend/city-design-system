import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	accordionHeadingLevel: {
		value: 4,
		unit: 'heading level',
		meaning: 'Heading level of an accordion trigger',
		rationale: 'Places the trigger below the pane heading.'
	}
});

export const defaults = settingValues(settings);
