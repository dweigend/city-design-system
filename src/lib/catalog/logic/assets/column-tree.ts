import { mount, type AssetRecipe } from './definition';
import { treeCrown } from './production/tree-crown';
export const columnTree: AssetRecipe = {
	id: 'column-tree',
	slotNames: ['trim', 'planting'],
	category: 'planting',
	variants: ['cypress', 'poplar', 'fastigiate'],
	footprint: [3.1, 3.1],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		return treeCrown('blocks', [0, 0, 0], 1.35 * (0.8 + 0.1 * variant), variant, sample, 'trim');
	}
};
