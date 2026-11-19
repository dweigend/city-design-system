import { mount, type AssetRecipe } from './definition';
import { drum, bulb } from './parts';

import { panel } from './objects/forms';

export const treeTrough: AssetRecipe = {
	id: 'tree-trough',
	slotNames: ['body', 'planting', 'trim'],
	category: 'planting',
	variants: ['single', 'avenue', 'grove'],
	footprint: [7.9, 3.3],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const n = variant + 1,
			w = 2.45 * n,
			parts = [
				panel(0, 0, 0, w - 0.1, 2.02, 0.59, 'body'),
				panel(0, 0, 0.59, w, 2.12, 0.07, 'body'),
				panel(0, 0, 0.66, w - 0.22, 1.88, 0.08, 'planting')
			];
		for (let i = 0; i < n; i++) {
			const x = (i - (n - 1) / 2) * 2.45,
				r = 1.13 + 0.16 * sample;
			parts.push(
				drum([x, 0, 0.74], 0.11, 1.65, 'trim'),
				bulb([x, 0, 2.65 + (i % 2) * 0.2], r, 0.76, 'planting')
			);
		}
		return parts;
	}
};
