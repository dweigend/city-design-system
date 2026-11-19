import { mount, type AssetRecipe } from './definition';
import { panel } from './objects/forms';

export const balcony: AssetRecipe = {
	id: 'balcony',
	slotNames: ['body', 'trim'],
	category: 'facades',
	variants: ['juliet', 'gallery', 'corner-seat'],
	footprint: [1.85, 4.8],
	anchors: [mount('facade')],
	draw(variant, sample) {
		const depth = [0.42, 1.45, 1.74][variant],
			width = [2.2, 4.6, 3.3][variant],
			height = 0.84 + 0.06 * sample;
		const face = depth - 0.12;
		const parts = [
			panel(depth / 2, 0, 0, depth, width, 0.24, 'body'),
			panel(face, 0, 0.24, 0.24, width, height, 'body'),
			panel(face, 0, height + 0.24, 0.24, width, 0.12, 'trim'),
			...[-1, 1].map((side) =>
				panel(
					(depth - 0.21) / 2,
					side * (width / 2 - 0.11),
					0.24,
					depth - 0.21,
					0.22,
					height,
					'body'
				)
			)
		];
		if (variant === 2) parts.push(panel(0.46, -width / 4, 0.24, 0.68, 1.32, 0.43, 'trim'));
		return parts;
	}
};
