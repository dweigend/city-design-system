import { mount, type AssetRecipe } from './definition';
import { slab, surface, living, pane } from './parts';

export const livingCapsule: AssetRecipe = {
	id: 'living-capsule',
	category: 'capsules',
	variants: ['studio', 'twin', 'longhouse'],
	footprint: [9.1, 3.1],
	anchors: [mount('deck')],
	draw(variant, sample) {
		const half = [1.25, 2.0, 3][variant],
			r = 1.34 + 0.045 * sample,
			z = r + 0.23;
		const parts = [
			slab([-half, -0.83, 0], [half * 2, 1.66, 0.54], living),
			{
				...surface(),
				kind: 'capsule' as const,
				from: [-half, 0, z] as [number, number, number],
				to: [half, 0, z] as [number, number, number],
				radius: r
			}
		];
		for (const side of [-1, 1]) {
			const y = side < 0 ? -r - 0.012 : r - 0.12;
			parts.push(slab([-half - 0.13, y, z - 0.26], [2 * half + 0.26, 0.132, 0.58], pane));
			for (let i = 0; i < variant + 2; i++)
				parts.push(
					slab(
						[
							-half + ((i + 0.5) * 2 * half) / (variant + 2),
							side < 0 ? y - 0.02 : y + 0.11,
							z - 0.26
						],
						[0.055, 0.045, 0.58]
					)
				);
		}
		return parts;
	}
};
