import { mount, type AssetRecipe } from './definition';
import { drum, cap, surface } from './parts';
import type { Vec3 } from '../parametrik/types';
export const observatory: AssetRecipe = {
	id: 'observatory',
	slotNames: ['accent', 'body', 'glass'],
	category: 'roofs',
	variants: ['slit-dome', 'high-drum', 'survey-station'],
	footprint: [6.6, 6.6],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const r = [2.6, 2.25, 3.15][variant],
			base = [0.72, 1.65, 0.55][variant],
			rise = r * (0.83 + 0.06 * sample);
		const parts = [drum([0, 0, 0], r, base, 'accent'), cap([0, 0, base], r, rise)];
		const points = Array.from({ length: 23 }, (_, j): Vec3 => {
			const t = ((j + 1) * Math.PI) / 24;
			return [0, -r * Math.cos(t), base + rise * Math.sin(t)];
		});
		parts.push({ ...surface('glass'), kind: 'pipe', points, radius: 0.13 });
		return parts;
	}
};
