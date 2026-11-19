import { mount, type AssetRecipe } from './definition';
import { cap } from './parts';

export const shrub: AssetRecipe = {
	id: 'shrub',
	slotNames: ['planting'],
	category: 'planting',
	variants: ['cushion', 'hedge', 'cluster'],
	footprint: [3.9, 2.6],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const n = [1, 4, 3][variant],
			r = [0.93, 0.64, 0.56][variant] + 0.07 * sample;
		return Array.from({ length: n }, (_, i) => {
			const x = (i - (n - 1) / 2) * 0.73,
				y = variant === 2 ? ((i % 2) - 0.5) * 0.72 : 0;
			return cap([x, y, 0], r, r * (variant === 1 ? 1.48 : 0.86), 'planting');
		});
	}
};
