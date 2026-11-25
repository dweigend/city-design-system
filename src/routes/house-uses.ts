import type { StoreyProgram } from '../lib/domain/house-court';

export const houseUseLabels = {
	public: 'Public space',
	workshop: 'Workshop',
	office: 'Office',
	housing: 'Housing',
	'city-farm': 'City farm',
	greenhouse: 'Greenhouse'
} as const satisfies Record<StoreyProgram['use'], string>;

export const housePhaseLabels = {
	retained: 'Retained',
	addition: 'Addition'
} as const satisfies Record<StoreyProgram['phase'], string>;
