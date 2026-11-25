import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	terrainDrapeTolerance: {
		value: 1e-9,
		unit: 'ratio',
		meaning: 'Allowance in barycentric and segment coordinates for draping',
		rationale: 'Closes numeric gaps at shared terrain facets.'
	},
	terrainDrapeBucketM: {
		value: 16,
		unit: 'm',
		meaning: 'Default triangle bin side length for terrain draping',
		rationale: 'Limits overlap queries on ordinary city ground.'
	}
});

export const defaults = settingValues(settings);
