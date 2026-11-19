import type { ObjectGeometry } from './object-geometry';
import { mount, type AssetRecipe } from './definition';
import { surface } from './parts';

export const barrelVault: AssetRecipe = {
	id: 'barrel-vault',
	slotNames: ['body', 'accent'],
	category: 'roofs',
	variants: ['low-span', 'ribbed', 'twin'],
	footprint: [8.6, 6.4],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const n = variant === 2 ? 2 : 1,
			w = variant === 0 ? 5.7 : 4,
			l = 5.8,
			rise = (variant === 0 ? 1.35 : 2) + 0.12 * sample;
		const parts: ObjectGeometry[] = [];
		for (let j = 0; j < n; j++) {
			const x = (j - (n - 1) / 2) * w;
			parts.push({
				...surface(),
				kind: 'vault',
				position: [x, 0, 0],
				width: w,
				length: l,
				rise,
				thickness: 0.16
			});
			if (variant === 1)
				for (const y of [-2.6, -0.9, 0.9, 2.6])
					parts.push({
						...surface('accent'),
						kind: 'vault',
						position: [x, y, 0],
						width: w + 0.08,
						length: 0.13,
						rise: rise + 0.05,
						thickness: 0.12
					});
		}
		return parts;
	}
};
