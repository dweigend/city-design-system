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
	showIntervalMs: {
		value: 250,
		unit: 'ms',
		meaning: 'Shortest time between two showings of newly built houses while the queue is busy',
		bounds: { exclusiveMin: 0 },
		rationale:
			'Showing re-renders the whole town; four steps a second read as progress and leave the frames between for input.'
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
