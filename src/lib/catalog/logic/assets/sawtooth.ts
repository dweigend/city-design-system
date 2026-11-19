import { mount, type AssetRecipe } from './definition';
import { slab, surface, pane } from './parts';
import type { Primitive } from '../parametrik/types';
export const sawtooth: AssetRecipe = {
	id: 'sawtooth',
	category: 'roofs',
	variants: ['two-bay', 'north-light', 'workshop-hall'],
	footprint: [10.4, 5.1],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const n = variant + 2,
			w = 2.45,
			l = 4.8,
			h = 1.12 + 0.2 * sample;
		const parts: Primitive[] = [];
		for (let i = 0; i < n; i++) {
			const x = (i - n / 2) * w;
			parts.push(
				{ ...surface(), kind: 'wedge', position: [x, -l / 2, 0], size: [w, l, h], low: 0.12 },
				slab([x - 0.018, -l / 2 + 0.09, 0.19], [0.035, l - 0.18, h - 0.28], pane)
			);
		}
		return parts;
	}
};
