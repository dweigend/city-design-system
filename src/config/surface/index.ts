import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	cityHeightScaleM: {
		value: 140,
		unit: 'm',
		meaning: 'Upper tick of the city column height ramp',
		rationale: 'Preserves the distance covered by the city height palette.'
	},
	districtEnvelopeStrokePx: {
		value: 0.9,
		unit: 'CSS px',
		meaning: 'District outline width',
		rationale: 'Keeps district bodies readable on sloping ground.'
	},
	districtEnvelopeStrokeOpacity: {
		value: 0.8,
		unit: 'ratio',
		meaning: 'District outline opacity',
		rationale: 'Defines the edge while retaining the blue body color.'
	},
	planningLatticeStrokePx: {
		value: 0.68,
		unit: 'CSS px',
		meaning: 'Coarse carrier lattice line width',
		rationale: 'Keeps planning joints and guides subordinate to the volume.'
	},
	planningLatticeStrokeOpacity: {
		value: 0.53,
		unit: 'ratio',
		meaning: 'Coarse carrier lattice line opacity',
		rationale: 'Gives the carrier a light graphite treatment.'
	},
	cityPlanStrokePx: {
		value: 0.8,
		unit: 'CSS px',
		meaning: 'Width of dry plan cell edges',
		rationale: 'Makes the layout legible under buildings.'
	},
	cityPlanStrokeOpacity: {
		value: 0.82,
		unit: 'ratio',
		meaning: 'Opacity of dry plan cell edges',
		rationale: 'Preserves the distinction between plan grid and ground.'
	},
	cityWaterCellStrokePx: {
		value: 0.8,
		unit: 'CSS px',
		meaning: 'Width of water cell edges',
		rationale: 'Separates the water grid from filled water.'
	},
	cityWaterCellStrokeOpacity: {
		value: 0.75,
		unit: 'ratio',
		meaning: 'Opacity of water cell edges',
		rationale: 'Keeps the overlay visible without overpowering the water.'
	},
	cityCrossingStrokePx: {
		value: 3,
		unit: 'CSS px',
		meaning: 'Width of selected crossing strokes',
		rationale: 'Highlights connections over the river.'
	},
	cityCrossingStrokeOpacity: {
		value: 1,
		unit: 'ratio',
		meaning: 'Opacity of selected crossing strokes',
		rationale: 'Keeps crossing lines crisp over water and banks.'
	},
	cityLaneStrokePx: {
		value: 1.2,
		unit: 'CSS px',
		meaning: 'Width of reserved lane outlines',
		rationale: 'Shows lane hierarchy without competing with crossings.'
	},
	cityLaneStrokeOpacity: {
		value: 1,
		unit: 'ratio',
		meaning: 'Opacity of reserved lane outlines',
		rationale: 'Keeps lane outlines readable across plan surfaces.'
	},
	cityParcelStrokePx: {
		value: 0.7,
		unit: 'CSS px',
		meaning: 'Width of parcel outlines',
		rationale: 'Keeps subdivision lines finer than lane outlines.'
	},
	cityParcelStrokeOpacity: {
		value: 0.74,
		unit: 'ratio',
		meaning: 'Opacity of parcel outlines',
		rationale: 'Provides enough contrast against the public ground.'
	},
	cityHeightRampKnee: {
		value: 0.15,
		unit: 'ratio',
		meaning: 'Normalized height at the middle ramp color',
		rationale: 'Distinguishes low-rise columns over the lower part of the height range.'
	}
});

export const defaults = settingValues(settings);
