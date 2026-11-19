import { mount, type AssetRecipe } from './definition';
import { drum, surface } from './parts';

export const conifer: AssetRecipe = {
	id: 'conifer',
	slotNames: ['trim', 'planting'],
	category: 'planting',
	variants: ['spruce', 'fir', 'dwarf-pine'],
	footprint: [4.1, 4.1],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const r = [1.55, 1.85, 1.12][variant],
			n = variant === 1 ? 4 : 3,
			step = [0.9, 1.1, 0.53][variant] + sample * 0.1;
		const parts = [drum([0, 0, 0], 0.15, 1.25, 'trim')];
		for (let i = 0; i < n; i++)
			parts.push({
				...surface('planting'),
				kind: 'cone',
				position: [0, 0, 0.66 + i * step],
				radius: r * (1 - i / (n + 0.7)),
				height: step * (i === n - 1 ? 1.65 : 1.95)
			});
		return parts;
	}
};
