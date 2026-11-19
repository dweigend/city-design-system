import { mount, type AssetRecipe } from './definition';
import { slab, rod } from './parts';
import { corrugated } from './corrugated';
import { sheetMetal } from './sheet-metal';

export const shippingContainer: AssetRecipe = {
	id: 'shipping-container',
	slotNames: ['trim', 'body'],
	category: 'capsules',
	suggestions: { trim: corrugated.finishes['workshop-panel'], body: sheetMetal.finishes.brushed },
	variants: ['short', 'freight', 'high-cube'],
	footprint: [12.4, 2.8],
	anchors: [mount('deck')],
	draw(variant, sample) {
		const l = [4, 6.06, 12.19][variant],
			w = 2.44,
			h = variant === 2 ? 2.9 : 2.59;
		const parts = [slab([-l / 2, -w / 2, 0], [l, w, h], 'trim')];
		for (const y of [-w / 2, w / 2 - 0.16]) {
			for (const z of [0, h - 0.16]) parts.push(slab([-l / 2, y, z], [l, 0.16, 0.16]));
			for (const x of [-l / 2, l / 2 - 0.22]) parts.push(slab([x, y - 0.025, 0], [0.22, 0.21, h]));
		}
		for (const sign of [-1, 1]) {
			parts.push(
				slab([l / 2, -w / 2 + ((sign + 1) * w) / 4, 0.08], [0.04, w / 2 - 0.025, h - 0.16]),
				rod(
					[l / 2 + 0.039, sign * (0.5 + 0.1 * sample), 0.2],
					[l / 2 + 0.039, sign * (0.5 + 0.1 * sample), h - 0.2],
					0.06
				)
			);
		}
		return parts;
	}
};
