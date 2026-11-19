import { mount, type AssetRecipe } from './definition';
import { drum, bulb } from './parts';

export const columnTree: AssetRecipe = {
	id: 'column-tree',
	slotNames: ['trim', 'planting'],
	category: 'planting',
	variants: ['cypress', 'poplar', 'fastigiate'],
	footprint: [3.1, 3.1],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const r = [0.59, 0.91, 1.15][variant] + sample * 0.11,
			h = [3.55, 4.65, 3.25][variant];
		return [
			drum([0, 0, 0], 0.13, 1.6, 'trim'),
			bulb([0, 0, 1.1 + h / 2], r, h / (2 * r), 'planting')
		];
	}
};
