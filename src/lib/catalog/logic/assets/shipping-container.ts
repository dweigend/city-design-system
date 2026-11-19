import { mount, type AssetRecipe } from './definition';
import { slab, rod } from './parts';

export const shippingContainer: AssetRecipe = {
	id: 'shipping-container',
	slotNames: ['trim', 'body'],
	category: 'capsules',
	variants: ['short', 'freight', 'high-cube'],
	footprint: [12.4, 2.8],
	anchors: [mount('deck')],
	draw(variant, sample) {
		const l = [4, 6.06, 12.19][variant],
			w = 2.44,
			h = variant === 2 ? 2.9 : 2.59;
		const parts = [slab([-l / 2, -w / 2, 0], [l, w, h], 'trim')];
		const count = Math.round(l / (0.46 + 0.025 * sample));
		for (const side of [-1, 1])
			for (let i = 0; i < count; i++)
				parts.push(
					slab(
						[(-0.5 + (i + 0.5) / count) * l, (side * w) / 2 - 0.035, 0.12],
						[0.064, 0.07, h - 0.24],
						'trim'
					)
				);
		for (const sign of [-1, 1]) {
			parts.push(
				slab([l / 2, -w / 2 + ((sign + 1) * w) / 4, 0.08], [0.04, w / 2 - 0.025, h - 0.16]),
				rod([l / 2 + 0.07, sign * 0.53, 0.2], [l / 2 + 0.07, sign * 0.53, h - 0.2], 0.032)
			);
		}
		return parts;
	}
};
