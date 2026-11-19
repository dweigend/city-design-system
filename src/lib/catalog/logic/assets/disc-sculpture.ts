import { mount, type AssetRecipe } from './definition';
import { drum, ring, white, energy, living } from './parts';

export const discSculpture: AssetRecipe = {
	id: 'disc-sculpture',
	category: 'landmarks',
	variants: ['standing-disc', 'counterweight', 'stack'],
	footprint: [3.9, 4.8],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const r = 1.35 + 0.14 * sample;
		const parts = [drum([0, 0, 0], 0.74, 0.23), drum([0, 0, 0.23], 0.15, 2.75)];
		if (variant === 0) parts.push(ring([0, 0, 2.48], r, 0, 0.19, energy));
		if (variant === 1)
			parts.push(
				ring([0, -0.64, 2.4], r, 0, 0.15, living),
				ring([0.2, 0.79, 3.25], 0.86, 0, 0.15, energy)
			);
		if (variant === 2)
			for (let i = 0; i < 4; i++)
				parts.push(drum([0, 0, 0.72 + i * 0.66], r * (1 - i * 0.11), 0.2, i % 2 ? white : living));
		return parts;
	}
};
