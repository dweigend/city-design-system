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
	}
});

/** Frozen defaults consumed by the sandbox projection. */
export const defaults = settingValues(settings);
