import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	bayMemberWidthM: {
		value: 0.22,
		unit: 'm',
		meaning: 'Width of a square-profile member on a placeable lattice bay',
		principle: 'GRID-5'
	}
});

export const defaults = settingValues(settings);
