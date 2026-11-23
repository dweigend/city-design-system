import { defineSettings, settingValues } from '../setting';

/** Numeric settings and their provenance. */
export const settings = defineSettings({
	blockHeightDefaultM: {
		value: 4,
		unit: 'm',
		meaning: 'Default value for block bounding-box height',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockHeightMinM: {
		value: 1,
		unit: 'm',
		meaning: 'Lower limit for block bounding-box height',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockHeightMaxM: {
		value: 32,
		unit: 'm',
		meaning: 'Upper limit for block bounding-box height',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockHeightStepM: {
		value: 0.1,
		unit: 'm',
		meaning: 'Step size for block bounding-box height',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockWidthDefaultM: {
		value: 9,
		unit: 'm',
		meaning: 'Default value for block bounding-box width',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockWidthMinM: {
		value: 1,
		unit: 'm',
		meaning: 'Lower limit for block bounding-box width',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockWidthMaxM: {
		value: 32,
		unit: 'm',
		meaning: 'Upper limit for block bounding-box width',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockWidthStepM: {
		value: 0.1,
		unit: 'm',
		meaning: 'Step size for block bounding-box width',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockComplexityDefaultRatio: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Default value for block shape complexity',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockComplexityMinRatio: {
		value: 0,
		unit: 'ratio',
		meaning: 'Lower limit for block shape complexity',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockComplexityMaxRatio: {
		value: 1,
		unit: 'ratio',
		meaning: 'Upper limit for block shape complexity',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	blockComplexityStepRatio: {
		value: 0.01,
		unit: 'ratio',
		meaning: 'Step size for block shape complexity',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the published input schema and its snapping behavior.'
	}
});

/** Frozen defaults consumed by the owning module. */
export const defaults = settingValues(settings);
