import type { ObjectGeometry } from './object-geometry';
import { suggestions } from './objects/suggestions';
import { mount, type AssetRecipe } from './definition';
import { rod } from './parts';

export const ladder: AssetRecipe = {
	id: 'ladder',
	slotNames: ['body'],
	suggestions: { body: suggestions.frame },
	category: 'infrastructure',
	variants: ['service', 'roof-access', 'wide-rung'],
	footprint: [0.64, 1.28],
	anchors: [mount('facade')],
	draw(variant, sample) {
		const n = [8, 16, 12][variant],
			w = variant === 2 ? 0.96 : 0.62,
			spacing = 0.28 + 0.016 * sample,
			h = (n + 1) * spacing;
		const parts: ObjectGeometry[] = [];
		for (const sign of [-1, 1]) {
			const y = (sign * w) / 2;
			parts.push(rod([0.34, y, 0], [0.34, y, h], 0.075));
			for (const z of [0.16, h - 0.15]) parts.push(rod([0, y, z], [0.34, y, z], 0.065));
		}
		for (let i = 1; i <= n; i++)
			parts.push(rod([0.34, -w / 2, i * spacing], [0.34, w / 2, i * spacing], 0.06));
		return parts;
	}
};
