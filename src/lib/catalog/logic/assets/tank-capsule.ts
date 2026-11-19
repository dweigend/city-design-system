import type { ObjectGeometry } from './object-geometry';

import { mount, type AssetRecipe } from './definition';
import { slab, drum, ring, surface } from './parts';

export const tankCapsule: AssetRecipe = {
	id: 'tank-capsule',
	slotNames: ['channel', 'body'],
	category: 'capsules',
	variants: ['cistern', 'pressure-vessel', 'header'],
	footprint: [7.5, 3],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const half = [1.15, 1.85, 2.65][variant],
			r = [1.13, 1.23, 0.94][variant],
			z = r + 0.4;
		const parts: ObjectGeometry[] = [
			{
				...surface('channel'),
				kind: 'capsule' as const,
				from: [-half, 0, z] as [number, number, number],
				to: [half, 0, z] as [number, number, number],
				radius: r
			}
		];
		for (const x of [-half * 0.8, half * 0.8])
			parts.push(
				slab([x - 0.13, -r * 0.62, 0], [0.26, 1.24 * r, 0.79]),
				ring([x, 0, z], r + 0.05, r - 0.02, 0.13)
			);
		parts.push(drum([half * (sample - 0.5), 0, z + r - 0.07], 0.22, 0.2));
		return parts;
	}
};
