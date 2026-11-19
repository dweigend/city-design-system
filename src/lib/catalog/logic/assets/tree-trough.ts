import { mount, type AssetRecipe } from './definition';
import { slab, drum, bulb, food, workshop } from './parts';

export const treeTrough: AssetRecipe = {
	id: 'tree-trough',
	category: 'planting',
	variants: ['single', 'avenue', 'grove'],
	footprint: [7.9, 3.3],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const n = variant + 1,
			w = 2.45 * n,
			parts = [
				slab([-w / 2, -1.06, 0], [w, 2.12, 0.66]),
				slab([-w / 2 + 0.11, -0.94, 0.66], [w - 0.22, 1.88, 0.08], food)
			];
		for (let i = 0; i < n; i++) {
			const x = (i - (n - 1) / 2) * 2.45,
				r = 1.13 + 0.16 * sample;
			parts.push(
				drum([x, 0, 0.74], 0.11, 1.65, workshop),
				bulb([x, 0, 2.65 + (i % 2) * 0.2], r, 0.76, food)
			);
		}
		return parts;
	}
};
