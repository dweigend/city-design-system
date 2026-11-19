import { mount, type AssetRecipe } from './definition';
import { drum, bulb, rod } from './parts';

export const roundTree: AssetRecipe = {
	id: 'round-tree',
	slotNames: ['trim', 'planting'],
	category: 'planting',
	variants: ['standard', 'forked', 'orchard'],
	footprint: [5.8, 5.5],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const h = [2.05, 2.55, 1.38][variant],
			r = [1.65, 1.28, 1.13][variant] + 0.13 * sample;
		const parts = [drum([0, 0, 0], 0.15, h, 'trim')];
		for (const sign of [-1, 1]) {
			const x = sign * (variant === 0 ? 0.42 : 0.87),
				y = sign * (0.35 + 0.12 * sample),
				z = h + 0.7 + (sign + 1) * 0.19;
			parts.push(
				rod([0, 0, h * 0.65], [x, y, z], 0.09, 'trim'),
				bulb([x, y, z], r, 0.91, 'planting')
			);
		}
		return parts;
	}
};
