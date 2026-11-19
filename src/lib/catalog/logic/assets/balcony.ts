import { mount, type AssetRecipe } from './definition';
import { slab, rod } from './parts';

export const balcony: AssetRecipe = {
	id: 'balcony',
	slotNames: ['body', 'trim'],
	category: 'facades',
	variants: ['juliet', 'gallery', 'corner-seat'],
	footprint: [1.85, 4.8],
	anchors: [mount('facade')],
	draw(variant, sample) {
		const d = [0.42, 1.45, 1.74][variant],
			w = [2.2, 4.6, 3.3][variant],
			h = 1.15 + 0.05 * sample;
		const parts = [slab([0, -w / 2, 0], [d, w, 0.16])];
		for (const y of [-w / 2 + 0.06, w / 2 - 0.06]) {
			parts.push(
				rod([0.04, y, h], [d - 0.05, y, h], 0.04),
				rod([d - 0.05, y, 0.16], [d - 0.05, y, h], 0.045)
			);
		}
		parts.push(rod([d - 0.05, -w / 2 + 0.06, h], [d - 0.05, w / 2 - 0.06, h], 0.045));
		for (let i = 1; i < 6; i++)
			parts.push(
				rod([d - 0.05, -w / 2 + (i * w) / 6, 0.16], [d - 0.05, -w / 2 + (i * w) / 6, h], 0.027)
			);
		if (variant === 2) parts.push(slab([0.16, -w / 2 + 0.12, 0.16], [0.55, 1.4, 0.35], 'trim'));
		return parts;
	}
};
