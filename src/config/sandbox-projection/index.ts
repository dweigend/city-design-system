import { defineSettings, settingValues } from '../setting';

/** Hover marker settings in the shared sandbox projection. */
export const settings = defineSettings({
	hoverLiftM: {
		value: 0.4,
		unit: 'm',
		meaning: 'Height of the parcel marker above rendered ground',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the marker above both the reserved lanes and parcel outlines.'
	},
	hoverOpacity: {
		value: 1,
		unit: 'ratio',
		meaning: 'Opacity of the active parcel outline',
		bounds: { min: 0, max: 1 },
		rationale: 'Paint feedback stays legible on both light and dark ground.'
	},
	hoverStrokePx: {
		value: 2.5,
		unit: 'px',
		meaning: 'Screen width of the active parcel outline',
		bounds: { exclusiveMin: 0 },
		rationale: 'Keeps the active outline distinct from background parcel lines.'
	},
	markStrokePx: {
		value: 1.75,
		unit: 'px',
		meaning: 'Screen width of a stroke, skip or selection outline',
		bounds: { exclusiveMin: 0 },
		rationale: 'Quieter than the active outline, still above background parcel lines.'
	},
	volumeEdgePx: {
		value: 0.75,
		unit: 'px',
		meaning: 'Screen width of the hairline on the folds of a plain house volume',
		bounds: { exclusiveMin: 0 },
		principle: 'FORM-6'
	},
	volumeEdgeOpacity: {
		value: 0.55,
		unit: 'ratio',
		meaning: 'Opacity of the hairline on the folds of a plain house volume',
		bounds: { min: 0, max: 1 },
		principle: 'FORM-6'
	},
	volumeCreaseDeg: {
		value: 30,
		unit: 'deg',
		meaning: 'Fold between two faces of a volume above which their shared edge is drawn',
		bounds: { min: 0, max: 180 },
		rationale: 'Draws walls, eaves and ridges but not the facets of a curved mass.'
	},
	volumeEdgeDecimals: {
		value: 3,
		unit: 'digits',
		meaning: 'Decimals of a metre at which two vertices count as one when edges are matched',
		bounds: { min: 0 },
		rationale:
			'Millimetre matching joins faces triangulated apart without merging distinct corners.'
	}
});

/** Frozen defaults consumed by the sandbox projection. */
export const defaults = settingValues(settings);
