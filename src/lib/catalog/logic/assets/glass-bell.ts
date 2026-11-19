import { mount, type AssetRecipe } from './definition';
import { drum, rod, cap, surface } from './parts';
import type { Vec3 } from '../parametrik/types';
export const glassBell: AssetRecipe = {
	id: 'glass-bell',
	slotNames: ['body', 'glass'],
	category: 'roofs',
	suggestions: { glass: { material: 'greenhouse', finish: 'glas-klar', token: '--cat-health-3' } },
	variants: ['hothouse', 'cloche', 'winter-garden'],
	footprint: [6.7, 6.7],
	anchors: [mount('roof')],
	draw(variant, sample) {
		const r = [2.15, 1.4, 3.2][variant],
			wall = [0.85, 0.24, 1.48][variant],
			rise = r * (0.8 + 0.12 * sample);
		const skin = { ...cap([0, 0, wall], r, rise, 'glass') };
		const parts = [
			drum([0, 0, 0], r + 0.06, 0.14),
			{ ...drum([0, 0, 0.14], r, wall - 0.14, 'glass') },
			skin
		];
		for (let i = 0; i < [6, 4, 8][variant]; i++) {
			const angle = (i * 2 * Math.PI) / [6, 4, 8][variant],
				x = Math.cos(angle) * r,
				y = Math.sin(angle) * r;
			parts.push(rod([x, y, 0.12], [x, y, wall], 0.075), {
				...surface(),
				kind: 'pipe' as const,
				radius: 0.065,
				points: Array.from({ length: 10 }, (_, j): Vec3 => {
					const t = (j * Math.PI) / 18;
					return [x * Math.cos(t), y * Math.cos(t), wall + rise * Math.sin(t)];
				})
			});
		}
		return parts;
	}
};
