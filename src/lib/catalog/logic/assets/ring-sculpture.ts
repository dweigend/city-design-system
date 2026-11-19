import { mount, type AssetRecipe } from './definition';
import { drum, ring, workshop, living } from './parts';

export const ringSculpture: AssetRecipe = {
	id: 'ring-sculpture',
	category: 'landmarks',
	variants: ['oculus', 'crossed', 'chain'],
	footprint: [4.4, 4.4],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const r = 1.48 + 0.14 * sample;
		const parts = [drum([0, 0, 0], 0.86, 0.34), ring([0, 0, r + 0.19], r, r - 0.24, 0.32, living)];
		if (variant === 1)
			parts.push({
				...ring([0, 0, r + 0.25], r * 0.87, r * 0.69, 0.26, workshop),
				rotation: Math.PI / 2
			});
		if (variant === 2)
			parts.push({ ...ring([0, 0, r * 2.65], r * 0.79, r * 0.62, 0.24), rotation: Math.PI * 0.38 });
		return parts;
	}
};
