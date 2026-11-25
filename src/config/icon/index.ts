import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	iconSizePx: {
		value: 16,
		unit: 'CSS px',
		meaning: 'Side of a shared control glyph',
		rationale: 'Keeps glyphs aligned with control text.'
	},
	iconStrokeWidth: {
		value: 1.5,
		unit: 'SVG units',
		meaning: 'Lucide stroke width in view box coordinates',
		rationale: 'Matches the weight of surrounding control outlines.'
	}
});

export const defaults = settingValues(settings);
