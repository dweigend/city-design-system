import { WALKWAY_WIDTH_M } from '../walkway';
import { mount, type AssetRecipe } from './definition';
import { slab } from './parts';

export const walkwayStop: AssetRecipe = {
	id: 'walkway-stop',
	category: 'access',
	variants: ['landing', 'terrace', 'plaza'],
	footprint: [2 * WALKWAY_WIDTH_M, 2 * WALKWAY_WIDTH_M],
	anchors: [mount('deck')],
	slotNames: ['deck', 'plaza'],
	draw(variant) {
		const width = (1 + variant * 0.5) * WALKWAY_WIDTH_M;
		return [
			slab([-width / 2, -width / 2, 0], [width, width, 0.25], variant === 2 ? 'plaza' : 'deck')
		];
	}
};
