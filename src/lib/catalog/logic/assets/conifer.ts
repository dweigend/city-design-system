import { mount, type AssetRecipe } from './definition';
import { treeCrown } from './production/tree-crown';
export const conifer: AssetRecipe = {
	id: 'conifer',
	slotNames: ['trim', 'planting'],
	category: 'planting',
	variants: ['spruce', 'fir', 'dwarf-pine'],
	footprint: [4.1, 4.1],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		return treeCrown('folds', [0, 0, 0], 1.85 * (0.8 + 0.1 * variant), variant, sample, 'trim');
	}
};
