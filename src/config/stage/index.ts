import { defineSettings, joinSettings, settingValues } from '../setting';
import { cameraSettings } from './camera';
import { terrainSettings } from './terrain';
import { drawingSettings } from './drawing';

/** Spatial partition for retained stage geometry. */
const batchingSettings = defineSettings({
	chunkSizeM: {
		value: 192,
		unit: 'm',
		meaning: 'Side length of a stage geometry tile in local XY meters',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps a parcel edit local while batching several blocks per visible draw.'
	}
});

export const settings = joinSettings(
	batchingSettings,
	cameraSettings,
	terrainSettings,
	drawingSettings
);

export const defaults = settingValues(settings);
