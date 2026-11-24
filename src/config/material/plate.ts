import { defineSettings } from '../setting';

export const plate = defineSettings({
	plateSideDefaultM: {
		value: 2,
		unit: 'm',
		meaning: 'Default side of a free surface sample',
		rationale: 'Large enough to show several surface modules'
	},
	plateSideMinM: {
		value: 1,
		unit: 'm',
		meaning: 'Smallest useful free surface sample',
		rationale: 'Show the patch and at least one repeating unit'
	},
	plateSideMaxM: {
		value: 4,
		unit: 'm',
		meaning: 'Largest editable free surface sample',
		rationale: 'Bound the size of one portable sample'
	},
	plateSideStepM: {
		value: 0.1,
		unit: 'm',
		meaning: 'Editing increment for the sample sides',
		rationale: 'Permit dimensions to follow metric subdivisions'
	},
	plateBackingM: {
		value: 0.12,
		unit: 'm',
		meaning: 'Backing thickness of a free surface sample',
		rationale: 'Show the material edge on a ground specimen'
	}
});
