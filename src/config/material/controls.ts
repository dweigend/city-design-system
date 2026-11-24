import { defineSettings } from '../setting';

const positive = { exclusiveMin: 0 } as const;

/** World-space lift of pencil joints. */
export const controls = defineSettings({
	pencilLiftM: {
		value: 0.004,
		unit: 'm',
		meaning: 'Offset of pencil joint lines in front of the flat face',
		bounds: positive,
		rationale: 'Keeps the lines from flickering into the face they sit on.'
	}
});
