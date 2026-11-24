import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	startupAreaM2: {
		value: 10_800,
		unit: 'm²',
		meaning: 'Area a growth region must accumulate before its first published step',
		rationale: 'Preserves the minimum size of a new city region.'
	},
	maxRegions: {
		value: 8,
		unit: 'count',
		meaning: 'Maximum regions eligible to start growing',
		rationale: 'Preserves the city footprint limit on independent regions.'
	},
	mainPartAreaM2: {
		value: 1_000_000,
		unit: 'm²',
		meaning: 'Area above which a growth region carries no satellite entry cost',
		rationale: 'Preserves the ordering of existing city regions.'
	},
	satelliteEntryM: {
		value: 180,
		unit: 'm',
		meaning: 'Maximum additional entry cost for a small growth region',
		rationale: 'Preserves the ordering of existing city regions.'
	},
	crossingCostPerMeter: {
		value: 1.15,
		unit: 'ratio',
		meaning: 'Additional access cost per meter of crossing span',
		rationale: 'Preserves the ordering of existing river crossings.'
	},
	bayMemberWidthM: {
		value: 0.22,
		unit: 'm',
		meaning: 'Width of a square-profile member on a placeable lattice bay',
		principle: 'GRID-5'
	}
});

export const defaults = settingValues(settings);
