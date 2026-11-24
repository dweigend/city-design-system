import { defineSettings, settingValues } from '../setting';

/** Settings for interpreting city lattice geometry as a structural study. */
export const settings = defineSettings({
	uprightRunPerRise: {
		value: 0.06,
		unit: 'ratio',
		meaning: 'Largest horizontal run per rise of a column',
		rationale: 'Allows numerical drift while keeping inclined braces distinct'
	},
	ringIntervalLevels: {
		value: 3,
		unit: 'level',
		meaning: 'Interval between primary chords on the exposed shell',
		principle: 'FORM-6'
	},
	loadIntensityPercent: {
		value: [0, 100, 250, 10],
		unit: '%',
		meaning: 'Demo load intensity minimum, default, maximum, and step',
		rationale: 'Shows the frame unloaded, under nominal load, and above the reference demand'
	},
	tributaryWeightKNM3: {
		value: 0.035,
		unit: 'kN/m³',
		meaning: 'Nominal gravity per cubic meter of lattice solid',
		rationale: 'Represents sparse occupancy of the coarse volume in this study'
	}
});

/** Values consumed by the city lattice adapter. */
export const defaults = settingValues(settings);
