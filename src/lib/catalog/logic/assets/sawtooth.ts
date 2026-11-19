import type { ObjectGeometry } from './object-geometry';
import { mount, type AssetRecipe } from './definition';
import { slab, surface } from './parts';

export const sawtooth: AssetRecipe = {
	id: 'sawtooth',
	slotNames: ['body', 'glass'],
	category: 'roofs',
	variants: ['two-bay', 'north-light', 'workshop-hall'],
	footprint: [10.4, 5.1],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const n = variant + 2,
			w = 2.45,
			l = 4.8,
			h = 1.12 + 0.2 * sample;
		const parts: ObjectGeometry[] = [];
		for (let i = 0; i < n; i++) {
			const x = (i - n / 2) * w;
			parts.push(
				{ ...surface(), kind: 'wedge', position: [x, -l / 2, 0], size: [w, l, h], low: 0.12 },
				slab([x - 0.018, -l / 2 + 0.09, 0.19], [0.035, l - 0.18, h - 0.28], 'glass')
			);
		}
		return parts;
	}
};
