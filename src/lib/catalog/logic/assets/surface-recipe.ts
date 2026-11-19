import type { AssetRecipe, AssetSurface } from './definition';
import { mount } from './definition';
import { slab } from './parts';

/** A folded sample shows the same finish on a horizontal and a vertical face. */
export function surfaceRecipe(id: string, finishes: Record<string, AssetSurface>): AssetRecipe {
	const variants = Object.keys(finishes);
	return {
		id,
		category: 'surfaces',
		variants,
		footprint: [3.4, 2.45],
		anchors: [mount('deck')],
		finishes,
		draw(variant, sample) {
			const treatment = finishes[variants[variant]];
			const height = 1.02 + 0.08 * sample;
			return [
				{ ...slab([-1.65, -1.18, 0], [3.3, 2.36, 0.16]), ...treatment },
				{ ...slab([-1.65, 0.99, 0.16], [3.3, 0.19, height]), ...treatment }
			];
		}
	};
}
