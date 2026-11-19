import { mount, type AssetRecipe } from './definition';
import { slab, rod } from './parts';

export const roofTerrace: AssetRecipe = {
	id: 'roof-terrace',
	slotNames: ['body', 'trim'],
	category: 'roofs',
	variants: ['square', 'promenade', 'lookout'],
	footprint: [7.3, 4.9],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const w = [4.5, 7, 3.6][variant],
			l = [4.5, 3.1, 4.7][variant],
			z = 1.23 + 0.09 * sample;
		const parts = [slab([-w / 2, -l / 2, 0], [w, l, 0.2])];
		for (const y of [-l / 2 + 0.09, l / 2 - 0.09]) {
			parts.push(rod([-w / 2 + 0.09, y, z], [w / 2 - 0.09, y, z], 0.075));
			for (const x of [-w / 2 + 0.09, 0, w / 2 - 0.09])
				parts.push(rod([x, y, 0.2], [x, y, z], 0.095));
		}
		for (const x of [-w / 2 + 0.09, w / 2 - 0.09])
			parts.push(rod([x, -l / 2 + 0.09, z], [x, l / 2 - 0.09, z], 0.075));
		if (variant === 2) parts.push(slab([-0.42, -1, 0.2], [0.84, 2, 0.38], 'trim'));
		return parts;
	}
};
