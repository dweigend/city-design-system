import { mount, type AssetRecipe } from './definition';
import { panel } from './objects/forms';
import { cap } from './parts';

export const greenRoof: AssetRecipe = {
	id: 'green-roof',
	slotNames: ['body', 'planting'],
	category: 'roofs',
	variants: ['sedum-mat', 'strip-garden', 'meadow-islands'],
	footprint: [6.4, 4.6],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const w = 6,
			l = 4.35,
			parts = [panel(0, 0, 0, w, l, 0.2, 'body')];
		if (variant === 0) parts.push(panel(0, 0, 0.2, 5.68, 4.04, 0.18, 'planting'));
		if (variant === 1)
			for (const y of [-1.43, 0, 1.43]) parts.push(panel(0, y, 0.2, 5.5, 0.92, 0.22, 'planting'));
		if (variant === 2)
			for (const [x, y, r] of [
				[-1.5, -0.55, 1.12],
				[0.65, 0.72, 0.96],
				[1.75, -0.85, 0.69]
			])
				parts.push(cap([x, y, 0.2], r, 0.24 + 0.17 * sample, 'planting'));
		return parts;
	}
};
