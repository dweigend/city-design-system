import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	popoverOffsetPx: {
		value: 4,
		unit: 'CSS px',
		meaning: 'Gap between a popover and its trigger',
		rationale: 'Keeps their outlines visually distinct.'
	},
	popoverCollisionPaddingPx: {
		value: 16,
		unit: 'CSS px',
		meaning: 'Popover clearance from the viewport edge',
		rationale: 'Leaves space for the popover to open against an edge.'
	}
});

export const defaults = settingValues(settings);
