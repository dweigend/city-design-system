import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	sculptureScaleBand: {
		value: [0.5, 1.5, 1, 0.05],
		unit: 'ratio',
		meaning: 'Minimum, maximum, default and step of uniform sculpture scale',
		rationale: 'Keeps the same proportions from pocket plazas to larger civic spaces.'
	},
	sculptureRotationBandRad: {
		value: [-Math.PI, Math.PI, 0, Math.PI / 36],
		unit: 'rad',
		meaning: 'Minimum, maximum, default and step of rotation about world Z',
		rationale: 'Allows a full turn with simple alignment to surrounding walks.'
	},
	sculptureVariationM: {
		value: [-0.45, 0.45],
		unit: 'm',
		meaning:
			'Seeded horizontal shift of the portal crest, totem crown or canopy apex before scaling',
		rationale: 'Varies the silhouette while keeping the shifted element on its support.'
	},
	portalPierM: {
		value: [-4.5, -2.95, -1, 1, 0, 4.6],
		unit: 'm',
		meaning: 'Bounds of the main portal pier in x, y and z pairs',
		rationale: 'The broad pier anchors the stepped side of the opening.'
	},
	portalCorbelM: {
		value: [-4.5, -1.65, -1, 1, 4.6, 5.6],
		unit: 'm',
		meaning: 'Bounds of the portal step in x, y and z pairs',
		rationale: 'The step narrows the mouth of the opening below the lintel.'
	},
	portalPostM: {
		value: [2.55, 3.55, -0.7, 0.7, 0, 5.6],
		unit: 'm',
		meaning: 'Bounds of the slender portal post in x, y and z pairs',
		rationale: 'The narrow post counterpoints the heavier stepped pier.'
	},
	portalLintelM: {
		value: [-4.5, 4.35, -0.95, 0.95, 5.6, 6.45],
		unit: 'm',
		meaning: 'Bounds of the spanning portal lintel in x, y and z pairs',
		rationale: 'A continuous horizontal member makes the opening legible from a distance.'
	},
	portalCrestM: {
		value: [-1.85, 0.4, -0.72, 0.72, 6.45, 7.35],
		unit: 'm',
		meaning: 'Bounds of the portal crest in x, y and z pairs before its seeded offset',
		rationale: 'The offset crest breaks the horizontal roofline above the opening.'
	},
	totemFootM: {
		value: [-1.35, 1.35, -1.35, 1.35, 0, 0.65],
		unit: 'm',
		meaning: 'Bounds of the totem foot in x, y and z pairs',
		rationale: 'The low, broad foot gives the tall assembly a clear base.'
	},
	totemStemM: {
		value: [-0.7, 0.7, -0.62, 0.62, 0.65, 7.25],
		unit: 'm',
		meaning: 'Bounds of the continuous totem stem in x, y and z pairs',
		rationale: 'A narrow stem connects the foot, fins and crown.'
	},
	totemLowerFinM: {
		value: [-3.35, -0.7, -0.82, 0.76, 2.3, 3.05],
		unit: 'm',
		meaning: 'Bounds of the long lower fin in x, y and z pairs',
		rationale: 'The longest reach sits low and leaves space beneath the opposing fins.'
	},
	totemMiddleFinM: {
		value: [0.7, 2.95, -0.75, 0.95, 4.25, 5.22],
		unit: 'm',
		meaning: 'Bounds of the opposing middle fin in x, y and z pairs',
		rationale: 'The shorter, deeper fin shifts the silhouette back across the stem.'
	},
	totemUpperFinM: {
		value: [-0.5, 0.5, -2.35, -0.62, 6.03, 6.66],
		unit: 'm',
		meaning: 'Bounds of the upper fin in x, y and z pairs',
		rationale: 'An arm on the other axis gives the totem a distinct profile in oblique views.'
	},
	totemCrownM: {
		value: [-1.05, 1.05, -0.85, 0.85, 7.25, 8.65],
		unit: 'm',
		meaning: 'Bounds of the totem crown in x, y and z pairs before its seeded offset',
		rationale: 'The compact crown finishes the stack without repeating the fins.'
	},
	canopyPierM: {
		value: [2.8, 3.25, 1.65, 2.1],
		unit: 'm',
		meaning: 'Positive x and y bounds of each mirrored canopy pier',
		rationale: 'Four slender supports leave a clear space under the roof.'
	},
	canopyEavesM: {
		value: [-4.9, 4.9, -3.15, 3.15, 3.45, 3.8],
		unit: 'm',
		meaning: 'Bounds of the canopy fascia in x, y and z pairs',
		rationale: 'The fascia spans the piers and casts the roof silhouette beyond them.'
	},
	canopyApexM: {
		value: [-1.55, 0.65, 5.65],
		unit: 'm',
		meaning: 'Canopy apex in x, y and z before its seeded offset',
		rationale: 'The shallow off-axis apex divides the broad roof into unequal facets.'
	}
});

/** Numeric parameters and metric geometry for the static sculpture family. */
export const defaults = settingValues(settings);
