import { mount, type AssetRecipe } from './definition';
import { drum, bulb, rod } from './parts';

export const umbrellaTree: AssetRecipe = {
	id: 'umbrella-tree',
	slotNames: ['trim', 'planting'],
	category: 'planting',
	variants: ['parasol', 'split-crown', 'acacia'],
	footprint: [7.2, 6.6],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const reach = [1.05, 1.52, 1.8][variant],
			h = [2.3, 2.72, 3.1][variant],
			parts = [drum([0, 0, 0], 0.17, h, 'trim')];
		for (let i = 0; i < 3; i++) {
			const angle = (i * 2 * Math.PI) / 3 + sample * 0.4;
			const x = reach * Math.cos(angle),
				y = reach * Math.sin(angle),
				z = h + 0.86 + i * 0.15;
			parts.push(
				rod([0, 0, h - 0.5], [x, y, z], 0.15, 'trim'),
				bulb([x, y, z], variant === 0 ? 1.66 : 1.4, 0.37, 'planting')
			);
		}
		return parts;
	}
};
