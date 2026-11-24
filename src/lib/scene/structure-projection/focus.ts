import { createFocusResolver } from '../focus';

/** Structure focus shared by the study controls and member projection. */
export const structureFocusPreset = createFocusResolver(
	{
		all: { label: 'All members', subject: [] },
		primary: { label: 'Primary frame', subject: ['primary-members'] },
		utilization: {
			label: 'Utilization',
			subject: ['primary-members', 'secondary-members'],
			analysis: 'utilization'
		}
	},
	{
		'primary-members': { all: 'full', primary: 'full', utilization: 'full' },
		'secondary-members': { all: 'full', primary: 'hidden', utilization: 'full' }
	}
);

/** Structural display choices for the same graph. */
export type StructureView = (typeof structureFocusPreset.choices)[number];
