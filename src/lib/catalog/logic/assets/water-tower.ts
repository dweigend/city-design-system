import { mount, type AssetRecipe } from './definition';
import { drum, bulb, cap } from './parts';

export const waterTower: AssetRecipe = {
	id: 'water-tower',
	slotNames: ['body', 'channel'],
	category: 'infrastructure',
	variants: ['mushroom', 'standpipe', 'elevated-bowl'],
	footprint: [6.8, 6.8],
	anchors: [mount('deck')],
	draw(variant, sample) {
		const r = [2.7, 1.66, 3.19][variant],
			h = [4.6, 7.2, 5.15][variant] + sample * 0.3;
		const parts = [
			drum([0, 0, 0], r * 0.51, 0.22),
			drum([0, 0, 0.22], variant === 1 ? r * 0.78 : 0.52, h)
		];
		if (variant === 2) parts.push(bulb([0, 0, h + 0.63], r, 0.48, 'channel'));
		else parts.push(drum([0, 0, h + 0.22], r, variant === 1 ? 2.05 : 1.52, 'channel'));
		parts.push(cap([0, 0, h + (variant === 1 ? 2.27 : variant === 0 ? 1.74 : 0.66)], r, 0.45));
		return parts;
	}
};
