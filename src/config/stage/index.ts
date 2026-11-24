import { defineSettings, settingValues } from '../setting';

/** Spatial partition for retained stage geometry. */
export const settings = defineSettings({
	chunkSizeM: {
		value: 192,
		unit: 'm',
		meaning: 'Side length of a stage geometry tile in local XY meters',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps a parcel edit local while batching several blocks per visible draw.'
	}
});

export const defaults = settingValues(settings);
