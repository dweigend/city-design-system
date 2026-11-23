import { defineSettings, settingValues } from '../setting';

/** Numeric settings and their provenance. */
export const settings = defineSettings({
	unitNormalLengthToleranceRatio: {
		value: 1e-12,
		unit: 'ratio',
		meaning: 'Maximum absolute error from unit anchor length',
		bounds: { min: 0 },
		rationale: 'Accommodates roundoff when rotating a unit vector.'
	},
	houseEavesM: {
		value: 3,
		unit: 'm',
		meaning: 'Eaves elevation in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseRidgeM: {
		value: 4.6,
		unit: 'm',
		meaning: 'Ridge elevation in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	housePlinthHeightM: {
		value: 0.24,
		unit: 'm',
		meaning: 'Plinth height in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseRoofHalfDepthM: {
		value: 2.24,
		unit: 'm',
		meaning: 'Roof extent from the example center across its ridge',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseRoofHalfWidthM: {
		value: 3.24,
		unit: 'm',
		meaning: 'Roof extent from the example center along its ridge',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseFacadeInsetM: {
		value: 0.005,
		unit: 'm',
		meaning: 'Offset of the example door and windows from the facade plane',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseFootprintWidthM: {
		value: 6.3,
		unit: 'm',
		meaning: 'Footprint width in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseFootprintDepthM: {
		value: 4.3,
		unit: 'm',
		meaning: 'Footprint depth in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseBodyWidthM: {
		value: 6,
		unit: 'm',
		meaning: 'Wall box width in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseBodyDepthM: {
		value: 4,
		unit: 'm',
		meaning: 'Wall box depth in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseDoorWidthM: {
		value: 0.98,
		unit: 'm',
		meaning: 'Door width in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseDoorHeightM: {
		value: 2.12,
		unit: 'm',
		meaning: 'Door height in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseWindowOffsetM: {
		value: 1.75,
		unit: 'm',
		meaning: 'Lateral distance of each window from the example center',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseWindowSillM: {
		value: 0.99,
		unit: 'm',
		meaning: 'Window sill elevation in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseWindowWidthM: {
		value: 0.94,
		unit: 'm',
		meaning: 'Window width in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	},
	houseWindowHeightM: {
		value: 1.43,
		unit: 'm',
		meaning: 'Window height in the fixed house example',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the geometry of the documented house example.'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
