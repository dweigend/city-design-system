import { mount, type AssetRecipe } from './definition';
import { slab, bulb, rod, ring, surface, energy, workshop, living } from './parts';

export const memphis: AssetRecipe = {
	id: 'memphis',
	category: 'landmarks',
	variants: ['arch-and-ball', 'ziggurat', 'leaning-gate'],
	footprint: [5.4, 4],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const h = 2.25 + 0.26 * sample;
		if (variant === 0)
			return [
				{
					...surface(living),
					kind: 'arch',
					position: [0, 0, 0],
					width: 3.2,
					length: 0.67,
					rise: h,
					thickness: 0.4
				},
				bulb([0.64, 0, h + 0.52], 0.54, 1, energy)
			];
		if (variant === 1)
			return [
				slab([-1.7, -1, 0], [3.4, 2, 0.55]),
				slab([-1.4, -0.83, 0.55], [2.44, 1.66, 0.7], workshop),
				slab([-1.07, -0.67, 1.25], [1.36, 1.34, 0.58]),
				ring([-0.42, 0, 2.58], 0.84, 0.48, 0.27, living)
			];
		return [
			rod([-1.63, 0, 0.08], [-0.95, 0, h], 0.16, workshop),
			rod([1.56, 0, 0.08], [0.96, 0, h], 0.16, workshop),
			slab([-1.23, -0.26, h - 0.13], [2.42, 0.52, 0.32], living),
			bulb([0.76, 0, h + 0.61], 0.44, 1, energy)
		];
	}
};
