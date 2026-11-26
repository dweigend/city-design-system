import { defineSettings, settingValues } from '../setting';

/** Dimensions and sampling limits for spanned envelope geometry. */
export const settings = defineSettings({
	facadeBandCount: {
		value: 3,
		unit: 'count',
		meaning: 'Default number of facade band courses',
		bounds: { min: 1, max: 128 },
		rationale: 'Caps the work of meshing repeated bands and cuffs on each bay.'
	},
	facadeBandDepthM: {
		value: 0.34,
		unit: 'm',
		meaning: 'Depth of a spanned facade band',
		bounds: { exclusiveMin: 0 },
		rationale: 'Gives the band a visible sill and a shadowed reveal.'
	},
	envelopeClipGrowthM: {
		value: 0.13,
		unit: 'm',
		meaning: 'Total thickness added at a facade clip',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-5',
		rationale: 'Separates the connector silhouette from the band profile.'
	},
	envelopeClipLengthM: {
		value: 0.48,
		unit: 'm',
		meaning: 'Preferred length of a cuff from a grip along a seam',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-5',
		rationale: 'Makes the surveyed contact visible at building scale.'
	},
	envelopeClipSpanRatio: {
		value: 0.2,
		unit: 'ratio',
		meaning: 'Maximum fraction of a span occupied by each end clip',
		bounds: { exclusiveMin: 0, exclusiveMax: 0.5 },
		rationale: 'Keeps the connector ends separate even at short spans.'
	},
	membraneCuffWidthM: {
		value: 0.23,
		unit: 'm',
		meaning: 'Section width at a membrane grip',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-5',
		rationale: 'Makes each pinned edge contact visible against the fabric.'
	},
	membraneSagRatio: {
		value: 0.12,
		unit: 'ratio',
		meaning: 'Default unloaded sag relative to the shortest edge',
		bounds: { min: 0, max: 0.5 },
		rationale: 'Allows the fabric to dip while retaining the corner silhouette.'
	},
	membraneTensionRatio: {
		value: 0.65,
		unit: 'ratio',
		meaning: 'Default normalized tension of the membrane',
		bounds: { exclusiveMin: 0, max: 1 },
		rationale: 'Limits the center sag with the perimeter held.'
	},
	membraneSubdivisions: {
		value: 16,
		unit: 'count',
		meaning: 'Default sample intervals along each membrane axis',
		bounds: { min: 2, max: 128 },
		rationale: 'Resolves the fabric curvature within a bounded mesh budget.'
	},
	envelopeGripToleranceM: {
		value: 1e-8,
		unit: 'm',
		meaning: 'Minimum resolved span and allowance for projected edge-grip roundoff',
		bounds: { exclusiveMin: 0 },
		rationale: 'Rejects collapsed spans and absorbs roundoff in the surveyed frame.'
	}
});

/** Frozen defaults consumed by the envelope module. */
export const defaults = settingValues(settings);
