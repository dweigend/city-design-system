import { mount, type AssetRecipe } from './definition';
import { slab, rod, path } from './parts';

export const stairs: AssetRecipe = {
	id: 'stairs',
	category: 'infrastructure',
	variants: ['short-flight', 'wide-flight', 'landing-flight'],
	footprint: [7.3, 3.3],
	anchors: [mount('deck')],
	draw(variant, sample) {
		const n = [8, 12, 15][variant],
			w = [1.38, 2.86, 1.72][variant],
			t = 0.29 + 0.02 * sample,
			h = 0.172,
			landing = variant === 2 ? 0.93 : 0.38,
			l = n * t + landing,
			x0 = -l / 2;
		const parts = Array.from({ length: n }, (_, i) =>
			slab([x0 + i * t, -w / 2, 0], [t, w, (i + 1) * h], path)
		);
		parts.push(slab([x0 + n * t, -w / 2, 0], [landing, w, n * h]));
		for (const y of [-w / 2 + 0.055, w / 2 - 0.055]) {
			parts.push(
				rod([x0 + 0.05, y, h + 0.91], [x0 + (n - 1) * t + 0.05, y, n * h + 0.91], 0.044),
				rod([x0 + (n - 1) * t + 0.05, y, n * h + 0.91], [l / 2 - 0.05, y, n * h + 0.91], 0.044)
			);
			for (const i of [0, Math.floor(n / 2), n - 1])
				parts.push(
					rod(
						[x0 + i * t + 0.05, y, (i + 1) * h],
						[x0 + i * t + 0.05, y, (i + 1) * h + 0.91],
						0.035
					)
				);
		}
		return parts;
	}
};
