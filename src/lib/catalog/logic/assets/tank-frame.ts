import { mount, type AssetRecipe } from './definition';
import { slab, drum, rod, cap } from './parts';

export const tankFrame: AssetRecipe = {
	id: 'tank-frame',
	slotNames: ['body', 'channel'],
	category: 'infrastructure',
	variants: ['single-vessel', 'paired-vessels', 'filter-bank'],
	footprint: [8.3, 3.2],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const n = variant + 1,
			r = 1.17,
			w = n * 2.64,
			h = 2.1 + 0.25 * sample;
		const parts = [slab([-w / 2, -1.36, h], [w, 2.72, 0.18])];
		for (const y of [-1.15, 1.15])
			for (let i = 0; i <= n; i++) {
				const x = -w / 2 + 0.15 + (i * (w - 0.3)) / n;
				parts.push(drum([x, y, 0], 0.085, h));
				if (i < n) parts.push(rod([x, y, 0.14], [x + (w - 0.3) / n, y, h], 0.06));
			}
		for (let i = 0; i < n; i++) {
			const x = (i - (n - 1) / 2) * 2.64;
			parts.push(drum([x, 0, h + 0.18], r, 2.23, 'channel'), cap([x, 0, h + 2.41], r, 0.29));
		}
		return parts;
	}
};
