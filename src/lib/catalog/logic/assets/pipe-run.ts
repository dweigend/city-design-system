import { serviceBend } from './service-bend';
import { mount, type AssetRecipe } from './definition';
import { drum } from './parts';
import type { Vec3 } from '../parametrik/types';
export const pipeRun: AssetRecipe = {
	id: 'pipe-run',
	slotNames: ['channel', 'body', 'highlight', 'trim'],
	category: 'infrastructure',
	variants: ['water-elbow', 'power-riser', 'workshop-return'],
	footprint: [6.7, 4.7],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const slot = (['channel', 'highlight', 'trim'] as const)[variant],
			r = 0.17 + 0.035 * sample,
			top = [1.1, 2.38, 1.7][variant];
		const points: Vec3[] = [
			[-2.65, -1.15, 0.2],
			[-2.65, -1.15, top],
			[1.63, -1.15, top],
			[1.63, 1.47, top]
		];
		if (variant === 2) points.push([-0.52, 1.47, top]);
		return [
			serviceBend(points, r, slot),
			drum([-2.65, -1.15, 0], r * 1.55, 0.22),
			drum([1.63, 1.47, 0], 0.16, top)
		];
	}
};
