import type { ObjectGeometry } from './object-geometry';
import { suggestions } from './objects/suggestions';
import { mount, type AssetRecipe } from './definition';
import { slab, rod } from './parts';

import { stairCheek } from './stair-cheek';

export const escalator: AssetRecipe = {
	id: 'escalator',
	slotNames: ['body', 'deck', 'glass'],
	suggestions: { body: suggestions.frame, deck: suggestions.shell, glass: suggestions.screen },
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
		const parts: ObjectGeometry[] = [];
		for (let j = 0; j < tracks; j++) {
			const y = (j - (tracks - 1) / 2) * 1.78;
			parts.push(
				slab([-l / 2, y - 0.74, 0], [0.56, 1.48, 0.12]),
				slab([run / 2, y - 0.74, n * h], [0.56, 1.48, 0.12])
			);
			for (let i = 0; i < n; i++)
				parts.push(slab([-run / 2 + i * t, y - 0.61, i * h], [t, 1.22, h + 0.12], 'deck'));
			for (const side of [-0.69, 0.69]) {
				const Y = y + side;
				parts.push(
					rod([-run / 2, Y, 0.16], [run / 2, Y, n * h + 0.16], 0.15),
					rod([-run / 2, Y, 0.93], [run / 2, Y, n * h + 0.93], 0.077)
				);
				parts.push(stairCheek(-run / 2, run / 2, Y, 0.12, n * h + 0.12, 0.81, 0.13, 'glass'));
			}
		}
		return parts;
	}
};
