import { mount, type AssetRecipe } from './definition';
import { slab, rod, cap, food } from './parts';

export const roofPlanting: AssetRecipe = {
	id: 'roof-planting',
	category: 'planting',
	variants: ['grasses', 'succulents', 'groundcover'],
	footprint: [3.6, 2.6],
	anchors: [mount('roof'), mount('deck')],
	draw(variant, sample) {
		const parts = [slab([-1.64, -1.16, 0], [3.28, 2.32, 0.12], food)];
		for (let i = 0; i < 12; i++) {
			const x = ((i % 4) - 1.5) * 0.72,
				y = (Math.floor(i / 4) - 1) * 0.68;
			if (variant === 0) {
				for (const sign of [-1, 1])
					parts.push(
						rod([x, y, 0.12], [x + 0.17 * sign, y + 0.1, 0.48 + 0.13 * sample], 0.038, food)
					);
			} else
				parts.push(
					cap(
						[x, y, 0.12],
						variant === 1 ? 0.23 : 0.37,
						variant === 1 ? 0.28 + 0.1 * sample : 0.13,
						food
					)
				);
		}
		return parts;
	}
};
