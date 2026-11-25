import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	detailedHouseCap: {
		value: 48,
		unit: 'houses',
		meaning:
			'Maximum full-detail houses built for one town review across all frames and focuses (bounded by the 48-house salience ceiling)',
		bounds: { min: 0, max: 48 },
		principle: 'MAT-15'
	}
});

/** The runtime detail budget of the whole-town review. */
export const defaults = settingValues(settings);
