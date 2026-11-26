import { defineSettings, settingValues } from '../setting';

/** Socket and connector settings in metric units. */
export const settings = defineSettings({
	dockContactToleranceM: {
		value: 1e-8,
		unit: 'm',
		meaning: 'Roundoff allowance for face and bounds predicates',
		bounds: { exclusiveMin: 0 },
		rationale: 'Absorbs dot-product and projection roundoff when seating on a slanted face.'
	},
	collarInsetRatio: {
		value: 0.84,
		unit: 'ratio',
		meaning: 'Fraction of the face retained from its centroid to its rim',
		bounds: { exclusiveMin: 0, exclusiveMax: 1 },
		rationale: 'Leaves a reveal around a socket so the FORM-5 collar reads as a separate part.'
	},
	collarDepthM: {
		value: 0.24,
		unit: 'm',
		meaning: 'Maximum outward projection of the collar',
		bounds: { exclusiveMin: 0 },
		rationale: 'Makes the FORM-5 connector legible at the scale of a structural bay.'
	}
});

/** Frozen defaults for the face-dock module. */
export const defaults = settingValues(settings);
