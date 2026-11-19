import { mount, type AssetRecipe } from './definition';
import { slab, rod, surface, water } from './parts';
import type { Primitive } from '../parametrik/types';
export const solarRoof: AssetRecipe = {
	id: 'solar-roof',
	category: 'roofs',
	variants: ['single-rack', 'paired-array', 'power-canopy'],
	footprint: [7.8, 4.9],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const n = variant + 1,
			w = 2.4,
			l = 4.5,
			h = 1 + 0.12 * sample;
		const parts: Primitive[] = [];
		for (let i = 0; i < n; i++) {
			const x = (i - n / 2) * 2.53;
			for (const y of [-1.85, 1.85])
				parts.push(
					slab([x + 0.15, y, 0], [0.12, 0.12, 0.72]),
					slab([x + w - 0.28, y, 0], [0.12, 0.12, 0.31])
				);
			parts.push({
				...surface(water),
				kind: 'wedge',
				position: [x, -l / 2, 0.28],
				size: [w, l, h - 0.28],
				low: 0.09
			});
			for (let j = 1; j < 6; j++)
				parts.push(
					rod(
						[x, -l / 2 + (j * l) / 6, h + 0.018],
						[x + w, -l / 2 + (j * l) / 6, 0.28 + 0.09 * (h - 0.28) + 0.018],
						0.018
					)
				);
		}
		return parts;
	}
};
