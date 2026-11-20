import { houseStair } from '../../data/house-stair';
import { plate } from './assembly';
import { suggestions } from './objects/suggestions';
import { mount, type AssetRecipe } from './definition';
import { slab, rod } from './parts';

import { stairCheek } from './stair-cheek';

export const stairs: AssetRecipe = {
	id: 'stairs',
	slotNames: ['deck', 'body'],
	suggestions: { body: suggestions.frame, deck: suggestions.foot },
	category: 'infrastructure',
	variants: ['short-flight', 'wide-flight', 'landing-flight', 'winding-tread', 'straight-tread'],
	footprint: [7.3, 3.3],
	anchors: [mount('deck')],
	draw(variant, sample) {
		if (variant === 4)
			return [
				plate(
					[
						[-houseStair.going / 2, -houseStair.width / 2],
						[houseStair.going / 2, -houseStair.width / 2],
						[houseStair.going / 2, houseStair.width / 2],
						[-houseStair.going / 2, houseStair.width / 2]
					],
					0,
					houseStair.thickness,
					'deck'
				)
			];
		if (variant === 3) {
			const { width, radius, going, thickness } = houseStair;
			const angle = Math.asin(going / (2 * radius));
			const ring = ([-1, 1] as const).flatMap((sign) =>
				(sign < 0 ? [1, -1] : [-1, 1]).map((side) => {
					const r = radius + (side * width) / 2;
					return [r * Math.cos(angle) - radius, sign * r * Math.sin(angle)] as [number, number];
				})
			);
			return [plate(ring, 0, thickness, 'deck')];
		}
		const n = [8, 12, 15][variant],
			w = [1.65, 2.86, 1.72][variant],
			t = 0.29 + 0.02 * sample,
			h = 0.172,
			landing = variant === 2 ? 0.93 : 0.38,
			l = n * t + landing,
			x0 = -l / 2;
		// Each tread bears on both 0.30 m side stringers with a 0.15 m overlap.
		const parts = Array.from({ length: n }, (_, i) =>
			slab([x0 + i * t, -w / 2 + 0.15, i * h], [t, w - 0.3, h], 'deck')
		);
		parts.push(slab([x0 + n * t, -w / 2, (n - 1) * h], [landing, w, h], 'deck'));
		for (const y of [-w / 2 + 0.15, w / 2 - 0.15]) {
			parts.push(
				slab([x0 + n * t, y - 0.15, Math.max(0, (n - 2) * h)], [landing, 0.3, h], 'body'),
				stairCheek(x0, x0 + n * t, y, 0, (n - 1) * h, 0.58, 0.3, 'body'),
				rod([x0 + 0.05, y, h + 0.91], [x0 + (n - 1) * t + 0.05, y, n * h + 0.91], 0.075),
				rod([x0 + (n - 1) * t + 0.05, y, n * h + 0.91], [l / 2 - 0.05, y, n * h + 0.91], 0.075)
			);
			for (const i of [0, Math.floor(n / 2), n - 1])
				parts.push(
					rod(
						[x0 + i * t + 0.05, y, (i + 1) * h],
						[x0 + i * t + 0.05, y, (i + 1) * h + 0.91],
						0.062
					)
				);
		}
		return parts;
	}
};
