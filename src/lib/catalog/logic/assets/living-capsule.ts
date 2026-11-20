import { mount, type AssetRecipe } from './definition';
import { panel } from './objects/forms';
import { cabinPaint, cabinGlass, cabinInk, cabinPort } from './objects/cabin-port';
import { ring, surface } from './parts';
import type { ObjectGeometry } from './object-geometry';

export const livingCapsule: AssetRecipe = {
	id: 'living-capsule',
	slotNames: ['accent', 'body', 'glass'],
	suggestions: {
		accent: cabinInk,
		body: cabinPaint,
		glass: cabinGlass
	},
	category: 'capsules',
	variants: ['studio', 'twin', 'longhouse'],
	footprint: [9.1, 3.1],
	anchors: [mount('deck')],
	draw(variant, sample) {
		const half = [1.25, 2, 3][variant],
			r = 1.15 + 0.045 * sample,
			z = 2.5 - r;
		const parts: ObjectGeometry[] = [
			panel(0, 0, 0, half * 2 + 0.9, 1.72, 0.52, 'accent'),
			{ ...surface(), kind: 'capsule', from: [-half, 0, z], to: [half, 0, z], radius: r }
		];
		for (const side of [-1, 1]) {
			for (let bay = 0; bay <= variant; bay++) {
				const x = half * ((2 * bay + 1) / (variant + 1) - 1);
				const bezel = ring([x, side * (r + 0.025), z], 0.66, 0.5, 0.26, 'accent');
				parts.push(
					{ ...bezel, rotation: Math.PI / 2 },
					{
						...bezel,
						slot: 'glass',
						radius: 0.51,
						innerRadius: 0,
						depth: 0.15,
						rotation: Math.PI / 2
					}
				);
			}
		}
		for (const side of [-1, 1]) {
			parts.push(ring([side * half, 0, z], r + 0.012, r - 0.025, 0.065, 'accent'));
			for (const port of cabinPort(side * (half + r + 0.16), z, 'accent', 'glass', side))
				parts.push({ ...port, curvature: r, rotation: side < 0 ? Math.PI : 0 });
		}
		return parts;
	}
};
