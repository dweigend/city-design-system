import { mount, type AssetRecipe } from './definition';
import { slab, drum, workshop } from './parts';

export const chimney: AssetRecipe = {
	id: 'chimney',
	category: 'infrastructure',
	variants: ['kiln-stack', 'banded-flue', 'twin-flue'],
	footprint: [4.5, 3.3],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const n = variant === 2 ? 2 : 1,
			h = [5.2, 7.4, 4.8][variant] + sample * 0.4;
		const parts = [slab([-n * 0.86, -0.97, 0], [n * 1.72, 1.94, 0.42])];
		for (let i = 0; i < n; i++) {
			const x = (i - (n - 1) / 2) * 1.72,
				top = h - i * 0.65,
				r = variant === 0 ? 0.74 : 0.58;
			parts.push(
				drum([x, 0, 0.42], r, top - 0.42, workshop),
				drum([x, 0, top], r + 0.12, 0.24),
				drum([x, 0, top + 0.24], r * 0.74, 0.016, '--ink')
			);
			if (variant === 1)
				for (const z of [1.8, 3.6, 5.4]) parts.push(drum([x, 0, z], r + 0.045, 0.15));
		}
		return parts;
	}
};
