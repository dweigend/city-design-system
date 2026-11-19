import { mount, type AssetRecipe } from './definition';
import { drum, cap, living, pane } from './parts';

export const dome: AssetRecipe = {
	id: 'dome',
	category: 'roofs',
	variants: ['saucer', 'hemisphere', 'lantern'],
	footprint: [6.8, 6.8],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const r = [3.2, 2.65, 2.35][variant],
			h = r * [0.45, 1, 0.8][variant];
		const parts = [drum([0, 0, 0], r + 0.07, 0.2), cap([0, 0, 0.2], r, h + 0.12 * sample, living)];
		if (variant === 2)
			parts.push(drum([0, 0, h + 0.08], 0.52, 0.5, pane), cap([0, 0, h + 0.58], 0.6, 0.27));
		return parts;
	}
};
