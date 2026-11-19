import { mount, type AssetRecipe } from './definition';
import { slab, pane } from './parts';

export const windowBand: AssetRecipe = {
	id: 'window-band',
	category: 'facades',
	variants: ['ribbon', 'clerestory', 'paired'],
	footprint: [0.35, 5.8],
	anchors: [mount('facade')],
	draw(variant, sample) {
		const bays = [5, 7, 2][variant],
			w = [4.8, 5.6, 3.8][variant],
			h = [0.84, 0.46, 1.18][variant] + 0.08 * sample;
		const parts = [
			slab([0, -w / 2, 0], [0.17, w, h]),
			slab([0.15, -w / 2 + 0.08, 0.08], [0.06, w - 0.16, h - 0.16], pane)
		];
		for (let i = 1; i < bays; i++)
			parts.push(slab([0.2, -w / 2 + (i * w) / bays - 0.025, 0.07], [0.055, 0.05, h - 0.14]));
		return parts;
	}
};
