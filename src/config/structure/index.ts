import { defineSettings, settingValues } from '../setting';

/** Nominal section sizes and gravity-routing reporting tolerance. */
export const settings = defineSettings({
	secondaryWidthM: {
		value: 0.16,
		unit: 'm',
		meaning: 'Outside width of a light square member',
		principle: 'FORM-6'
	},
	primaryWidthM: {
		value: 0.48,
		unit: 'm',
		meaning: 'Outside width of a primary square member',
		principle: 'FORM-6'
	},
	secondaryAreaM2: {
		value: 0.003,
		unit: 'm²',
		meaning: 'Nominal steel area of the light section',
		rationale: 'Representative thin-walled section for the gravity study'
	},
	primaryAreaM2: {
		value: 0.021,
		unit: 'm²',
		meaning: 'Nominal steel area of the primary section',
		rationale: 'Representative heavier hollow section for the gravity study'
	},
	nominalStressKPa: {
		value: 160000,
		unit: 'kPa',
		meaning: 'Reference axial stress used to normalize the force estimate',
		rationale: 'A fixed display reference across section classes and load cases'
	},
	balanceToleranceRatio: {
		value: 1e-9,
		unit: 'ratio',
		meaning: 'Permitted relative vertical load balance error',
		rationale: 'Allows roundoff after accumulating and splitting joint loads'
	}
});

/** Values consumed by the structural graph. */
export const defaults = settingValues(settings);
