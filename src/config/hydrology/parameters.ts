import type { Setting } from '../setting';

export const parameters = {
	sinuosityDefaultRatio: {
		value: 1.15,
		unit: 'ratio',
		meaning: 'Default value for nominal course sinuosity',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	sinuosityMinRatio: {
		value: 1.04,
		unit: 'ratio',
		meaning: 'Lower limit for nominal course sinuosity',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	sinuosityMaxRatio: {
		value: 1.28,
		unit: 'ratio',
		meaning: 'Upper limit for nominal course sinuosity',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	sinuosityStepRatio: {
		value: 0.01,
		unit: 'ratio',
		meaning: 'Step size for nominal course sinuosity',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	reliefDefaultRatio: {
		value: 0,
		unit: 'ratio',
		meaning: 'Default value for terrain relief',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	reliefMinRatio: {
		value: 0,
		unit: 'ratio',
		meaning: 'Lower limit for terrain relief',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	reliefMaxRatio: {
		value: 1,
		unit: 'ratio',
		meaning: 'Upper limit for terrain relief',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	reliefStepRatio: {
		value: 0.05,
		unit: 'ratio',
		meaning: 'Step size for terrain relief',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	runoffDefaultRatio: {
		value: 1,
		unit: 'ratio',
		meaning: 'Default value for runoff multiplier',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	runoffMinRatio: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Lower limit for runoff multiplier',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	runoffMaxRatio: {
		value: 1.5,
		unit: 'ratio',
		meaning: 'Upper limit for runoff multiplier',
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	runoffStepRatio: {
		value: 0.1,
		unit: 'ratio',
		meaning: 'Step size for runoff multiplier',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the published input schema and its snapping behavior.'
	},
	sinuosityRoundingDigits: {
		value: 2,
		unit: 'count',
		meaning: 'Decimal digits used to normalize resolved sinuosity',
		bounds: { min: 0 },
		rationale: 'Keeps generator input stable after schema snapping.'
	},
	reliefRoundingDigits: {
		value: 2,
		unit: 'count',
		meaning: 'Decimal digits used to normalize resolved relief',
		bounds: { min: 0 },
		rationale: 'Keeps generator input stable after schema snapping.'
	},
	runoffRoundingDigits: {
		value: 1,
		unit: 'count',
		meaning: 'Decimal digits used to normalize resolved runoff',
		bounds: { min: 0 },
		rationale: 'Keeps generator input stable after schema snapping.'
	},
	minimumImportedWetWidthM: {
		value: 20,
		unit: 'm',
		meaning: 'Minimum channel width allowed for imported flow calibration',
		bounds: { exclusiveMin: 0 },
		principle: 'CITY-11'
	}
} as const satisfies Readonly<Record<string, Setting>>;
