import { defineSettings, settingValues } from '../setting';

/** Portable sandbox addresses and restore budgets. */
export const settings = defineSettings({
	maxRestoreBytes: {
		value: 16 * 1024 * 1024,
		unit: 'byte',
		meaning: 'Maximum UTF-8 size of a saved sandbox document',
		bounds: { exclusiveMin: 0 },
		rationale: 'Fits the seeded town and ordinary edit history while bounding JSON parsing.'
	},
	maxRestoreEdits: {
		value: 20_000,
		unit: 'edit',
		meaning: 'Maximum combined number of stock placements and history edits in a save',
		bounds: { exclusiveMin: 0 },
		rationale: 'Bounds replay work including edits in the redo tail.'
	},
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
