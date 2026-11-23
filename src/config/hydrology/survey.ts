import type { Setting } from '../setting';

export const survey = {
	surveySideM: {
		value: 4000,
		unit: 'm',
		meaning: 'Default side length of the square ground survey',
		bounds: { exclusiveMin: 0 },
		rationale: 'Covers the central valley frame on both banks.'
	},
	surveySpacingM: {
		value: 20,
		unit: 'm',
		meaning: 'Default maximum spacing between ground survey nodes',
		bounds: { exclusiveMin: 0 },
		rationale: 'Samples terrain gradients on a finer grid than the drainage solve.'
	},
	surveyBuildableSlopeRatio: {
		value: 0.2,
		unit: 'ratio',
		meaning: 'Exclusive rise-to-run limit for dry nodes counted as buildable in the survey',
		bounds: { exclusiveMin: 0 },
		rationale: 'Reports a consistent share of gently sloped land across reliefs.'
	},
	surveyShoreToleranceM: {
		value: 0.01,
		unit: 'm',
		meaning: 'Allowed depth of dry ground below water at a sampled shoreline',
		bounds: { min: 0 },
		rationale: 'Allows one centimeter of residual error in the dry-side height check.'
	},
	surveyShoreBracketM: {
		value: 0.001,
		unit: 'm',
		meaning: 'Maximum remaining wet–dry bracket when comparing land and water heights',
		bounds: { exclusiveMin: 0 },
		rationale: 'Localizes both comparison samples to the same shoreline within one millimeter.'
	}
} as const satisfies Readonly<Record<string, Setting>>;
