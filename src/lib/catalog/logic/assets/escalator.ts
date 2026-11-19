import { mount, type AssetRecipe } from './definition';
import { slab, rod, path, pane } from './parts';
import type { Primitive } from '../parametrik/types';
export const escalator: AssetRecipe = {
	id: 'escalator',
	category: 'infrastructure',
	variants: ['compact', 'concourse', 'paired'],
	footprint: [7.8, 4.5],
	anchors: [mount('deck')],
	draw(variant, sample) {
		const n = [10, 15, 12][variant],
			tracks = variant === 2 ? 2 : 1,
			t = 0.34,
			h = 0.177 + 0.009 * sample,
			run = n * t,
			l = run + 1.12;
		const parts: Primitive[] = [];
		for (let j = 0; j < tracks; j++) {
			const y = (j - (tracks - 1) / 2) * 1.78;
			parts.push(
				slab([-l / 2, y - 0.74, 0], [0.56, 1.48, 0.12]),
				slab([run / 2, y - 0.74, n * h], [0.56, 1.48, 0.12])
			);
			for (let i = 0; i < n; i++)
				parts.push(slab([-run / 2 + i * t, y - 0.61, i * h], [t, 1.22, h + 0.12], path));
			for (const side of [-0.69, 0.69]) {
				const Y = y + side;
				parts.push(
					rod([-run / 2, Y, 0.08], [run / 2, Y, n * h + 0.08], 0.11),
					rod([-run / 2, Y, 0.93], [run / 2, Y, n * h + 0.93], 0.077)
				);
				for (let i = 0; i <= n; i += 1) {
					const x = -run / 2 + i * t;
					parts.push(slab([x - 0.04, Y - 0.036, i * h + 0.12], [0.08, 0.072, 0.8], pane));
				}
			}
		}
		return parts;
	}
};
