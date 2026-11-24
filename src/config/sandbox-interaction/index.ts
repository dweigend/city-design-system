import { defineSettings, settingValues } from '../setting';

/** Responsiveness and detail settings of sandbox interaction. */
export const settings = defineSettings({
	buildBudgetMs: {
		value: 6,
		unit: 'ms',
		meaning: 'Main-thread time one animation frame may spend building queued objects',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Leaves about ten of the 16.7 ms of a 60 Hz frame for input, the stage upload and drawing.'
	},
	reliefRadiusM: {
		value: 60,
		unit: 'm',
		meaning: 'Ground distance from the view centre within which houses show cladding relief',
		bounds: { min: 0 },
		principle: 'MAT-5',
		rationale: 'About two town blocks around the point the viewer looks at.'
	},
	reliefMaxMetersPerPixel: {
		value: 0.3,
		unit: 'm/px',
		meaning: 'Coarsest view scale at which nearby houses show relief',
		bounds: { exclusiveMin: 0 },
		principle: 'MAT-5',
		rationale: 'Relief modules narrower than about two pixels read as noise, not as material.'
	},
	previewEavesRatio: {
		value: 0.7,
		unit: 'ratio',
		meaning: 'Height of a preview body as a share of the painted house height',
		bounds: { exclusiveMin: 0, max: 1 },
		rationale: 'Roughly the eaves line, so the preview reads as a body without claiming the roof.'
	}
});

/** Frozen defaults consumed by the sandbox interaction module. */
export const defaults = settingValues(settings);
