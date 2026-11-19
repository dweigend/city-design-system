import { mount, type AssetRecipe } from './definition';
import { drum, rod, surface, path } from './parts';
import type { Vec3 } from '../parametrik/types';
export const spiralStair: AssetRecipe = {
	id: 'spiral-stair',
	category: 'infrastructure',
	variants: ['quarter-landing', 'full-turn', 'double-turn'],
	footprint: [4.9, 4.9],
	anchors: [mount('deck')],
	draw(variant, sample) {
		const turns = [0.75, 1, 2][variant],
			r = [1.7, 2.16, 1.93][variant],
			steps = Math.round(turns * 19),
			angle = (turns * 2 * Math.PI) / steps,
			rise = 0.167 + 0.012 * sample;
		const parts = [drum([0, 0, 0], 0.19, (steps + 1) * rise)];
		const rail: Vec3[] = [];
		for (let i = 0; i < steps; i++) {
			const a = i * angle,
				z = i * rise,
				polar = (radius: number, t: number): [number, number] => [
					radius * Math.cos(t),
					radius * Math.sin(t)
				];
			const polygon = [
				polar(0.15, a),
				polar(r, a),
				polar(r, a + angle / 2),
				polar(r, a + angle),
				polar(0.15, a + angle)
			];
			parts.push({ ...surface(path), kind: 'prism', polygon, z, height: 0.12 });
			const [x, y] = polar(r - 0.07, a + 0.5 * angle);
			if (i % 2 === 0 || i === steps - 1)
				parts.push(rod([x, y, z + 0.12], [x, y, z + 1.04], 0.032));
			rail.push([x, y, z + 1.04]);
		}
		parts.push({ ...surface(), kind: 'pipe', points: rail, radius: 0.045 });
		return parts;
	}
};
