import { defineSettings, settingValues } from '../setting';

/** Precision of portable sandbox ground addresses. */
export const settings = defineSettings({
	groundAddressStepM: {
		value: 0.001,
		unit: 'm',
		meaning: 'Spacing of the world XYZ grid used for ground placement identity',
		bounds: { exclusiveMin: 0 },
		rationale: 'A millimetre absorbs numerical jitter while preserving distinct placement points.'
	}
});

/** Frozen defaults consumed by the document. */
export const defaults = settingValues(settings);
