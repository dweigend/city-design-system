import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	minimumPlantingAreaM2: {
		value: 90,
		unit: 'm²',
		meaning: 'Smallest existing holding or court to receive a grove',
		principle: 'CITY-10'
	},
	shoreReachM: {
		value: 38,
		unit: 'm',
		meaning: 'Maximum dry bank clearance for the frontage of a riverside park',
		principle: 'CITY-5'
	},
	shoreParkLimit: {
		value: 12,
		unit: 'parcels',
		meaning: 'Maximum number of planted shore blocks, with one parcel per block',
		rationale: 'Leaves room for open promenades and alternating public uses along the water.'
	},
	parksPerDistrict: {
		value: 1,
		unit: 'blocks',
		meaning: 'Number of whole green blocks reserved per district kind',
		principle: 'CITY-16'
	},
	openGardenLimit: {
		value: 18,
		unit: 'gardens',
		meaning: 'Number of existing open spaces and unbuilt holdings planted away from study blocks',
		rationale: 'Distributes model greenery without filling every open space.'
	}
});

/** Park selection in the default town review recipe. */
export const defaults = settingValues(settings);
