import type { StoreyProgram } from '../lib/domain/house-court';
import { houseUseColors } from '../lib/scene/house-projection';

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

export function houseUseTone(use: StoreyProgram['use']) {
	return houseUseColors[use].slice(2);
}

export const houseUses = (Object.keys(houseUseLabels) as StoreyProgram['use'][]).map((use) => ({
	use,
	label: houseUseLabels[use],
	tone: houseUseTone(use)
}));
