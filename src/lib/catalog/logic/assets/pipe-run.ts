import { mount, type AssetRecipe } from './definition';
import { drum, bulb, rod, water, energy, workshop, path } from './parts';
import type { Primitive, Vec3 } from '../parametrik/types';
export const pipeRun: AssetRecipe = {
	id: 'pipe-run',
	category: 'infrastructure',
	variants: ['water-elbow', 'power-riser', 'workshop-return'],
	footprint: [6.7, 4.7],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const token = [water, energy, workshop][variant],
			r = 0.17 + 0.035 * sample,
			top = [1.1, 2.38, 1.7][variant];
		const path: Vec3[] = [
			[-2.65, -1.15, 0.2],
			[-2.65, -1.15, top],
			[1.63, -1.15, top],
			[1.63, 1.47, top]
		];
		if (variant === 2) path.push([-0.52, 1.47, top]);
		const parts: Primitive[] = [];
		for (let i = 1; i < path.length; i++)
			parts.push(rod(path[i - 1], path[i], r, token), bulb(path[i], r, 1, token));
		parts.push(drum([-2.65, -1.15, 0], r * 1.55, 0.2), drum([1.63, 1.47, 0], 0.083, top));
		return parts;
	}
};
