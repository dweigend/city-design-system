import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	stockPencilShare: {
		value: 1 / 6,
		unit: 'ratio',
		meaning: 'Share of transparent stock drawn in pencil',
		rationale: 'Mixes drawn buildings into plain stock volumes.',
		principle: 'COLOR-5'
	}
});

export const defaults = settingValues(settings);

export const { stockPencilShare } = defaults;
