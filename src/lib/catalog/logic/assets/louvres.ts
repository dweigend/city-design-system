import { mount, type AssetRecipe } from './definition';
import { slab } from './parts';

export const louvres: AssetRecipe = {
	id: 'louvres',
	slotNames: ['glass', 'trim'],
	category: 'facades',
	variants: ['horizontal', 'vertical', 'sun-breaker'],
	footprint: [0.76, 3.7],
	anchors: [mount('facade')],
	draw(variant, sample) {
		const w = 3.5,
			h = 1.8,
			n = [6, 9, 4][variant],
			depth = [0.3, 0.36, 0.72][variant];
		const parts = [slab([0, -w / 2, 0], [0.08, w, h], 'glass')];
		for (let i = 0; i < n; i++)
			parts.push(
				variant === 1
					? slab([0.08, -w / 2 + ((i + 0.5) * w) / n, 0], [depth - 0.08, 0.055, h], 'trim')
					: slab(
							[0.08, -w / 2, ((i + 0.5) * h) / n],
							[depth - 0.08, w, 0.055 + sample * 0.025],
							'trim'
						)
			);
		return parts;
	}
};
