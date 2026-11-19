import type { ObjectGeometry } from './object-geometry';
import { mount, type AssetRecipe } from './definition';
import { slab, rod, surface } from './parts';

export const solarRoof: AssetRecipe = {
	id: 'solar-roof',
	slotNames: ['body', 'channel'],
	category: 'roofs',
	variants: ['single-rack', 'paired-array', 'power-canopy'],
	footprint: [7.8, 4.9],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const n = variant + 1,
			w = 2.4,
			l = 4.5,
			h = 1 + 0.12 * sample;
		const parts: ObjectGeometry[] = [];
		for (let i = 0; i < n; i++) {
			const x = (i - n / 2) * 2.53;
			for (const y of [-1.85, 1.85])
				parts.push(
					slab([x + 0.15, y, 0], [0.12, 0.12, 0.72]),
					slab([x + w - 0.28, y, 0], [0.12, 0.12, 0.31])
				);
			parts.push({
				...surface('channel'),
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
