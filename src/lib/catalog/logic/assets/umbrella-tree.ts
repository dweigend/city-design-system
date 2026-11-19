import { mount, type AssetRecipe } from './definition';
import { treeCrown } from './production/tree-crown';
export const umbrellaTree: AssetRecipe = {
	id: 'umbrella-tree',
	slotNames: ['trim', 'planting'],
	category: 'planting',
	variants: ['parasol', 'split-crown', 'acacia'],
	footprint: [7.2, 6.6],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		return treeCrown('blocks', [0, 0, 0], 2.95 * (0.8 + 0.1 * variant), variant, sample, 'trim');
	}
};
