import { mount, type AssetRecipe } from './definition';
import { treeCrown } from './production/tree-crown';
export const roundTree: AssetRecipe = {
	id: 'round-tree',
	slotNames: ['trim', 'planting'],
	category: 'planting',
	variants: ['standard', 'forked', 'orchard'],
	footprint: [5.8, 5.5],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		return treeCrown('clumps', [0, 0, 0], 2.45 * (0.8 + 0.1 * variant), variant, sample, 'trim');
	}
};
