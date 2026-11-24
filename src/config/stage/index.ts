import { defineSettings, settingValues } from '../setting';

/** Spatial partition for retained stage geometry. */
export const settings = defineSettings({
	navigationMinZoom: {
		value: 0.55,
		unit: 'ratio',
		meaning: 'Minimum relative camera zoom during navigation',
		rationale: 'Preserves the standard stage zoom range.'
	},
	navigationMaxZoom: {
		value: 32,
		unit: 'ratio',
		meaning: 'Maximum relative camera zoom during navigation',
		rationale: 'Preserves the standard stage zoom range.'
	},
	chunkSizeM: {
		value: 192,
		unit: 'm',
		meaning: 'Side length of a stage geometry tile in local XY meters',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps a parcel edit local while batching several blocks per visible draw.'
	}
});

export const defaults = settingValues(settings);
