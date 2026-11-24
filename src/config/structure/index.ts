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
		value: 0.0135,
		unit: 'm²',
		meaning: 'Nominal steel area of the light section',
		rationale: 'Ideal welded square steel box, 160 mm outside with 25 mm plates'
	},
	primaryAreaM2: {
		value: 0.057344,
		unit: 'm²',
		meaning: 'Nominal steel area of the primary section',
		rationale: 'Ideal welded square steel box, 480 mm outside with 32 mm plates'
	},
	nominalStressKPa: {
		value: 210000,
		unit: 'kPa',
		meaning: 'Reference axial stress used to normalize the force estimate',
		rationale: 'Nominal axial reference near 60% of an assumed 355 MPa steel yield stress'
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
