import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	opposedDirectionTolerance: {
		value: 1e-8,
		unit: 'ratio',
		meaning: 'Minimum quaternion scalar before applying the opposite-axis rotation',
		rationale:
			'Preserve the positive-Z segment rotation used by the renderer at nearly opposite directions'
	},
	pierSides: {
		value: 8,
		unit: 'sides',
		meaning: 'Facets per circular support',
		rationale: 'Read as round at quarter zoom'
	},
	maximumMiterRatio: {
		value: 2,
		unit: 'm/m',
		meaning: 'Maximum width multiplier at a mitered deck joint',
		rationale: 'Keep corners within the clearance allowance'
	}
});

export const defaults = settingValues(settings);
