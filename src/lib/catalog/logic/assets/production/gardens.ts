import { circle } from '../assembly';
import { drum, cap, bulb, surface } from '../parts';
import { panel } from '../objects/forms';
import { series } from './series';
import type { ObjectGeometry } from '../object-geometry';

type Plant = 'cube' | 'cone' | 'cloud' | 'umbrella' | 'cypress' | 'fork' | 'rock';
const garden = series('roof-groves', 'roof', [3.75, 5, 7.5], ['solitary', 'paired', 'grove']);
function canopy(type: Plant, x: number, y: number, z: number, r: number): ObjectGeometry[] {
	switch (type) {
		case 'cube':
			return [panel(x, y, z, 1.55 * r, 1.55 * r, 1.48 * r, 'planting')];
		case 'cone':
			return [
				{ ...surface('planting'), kind: 'cone', position: [x, y, z], radius: r, height: 2 * r }
			];
		case 'cypress':
			return [bulb([x, y, z + r], r * 0.55, 2.1, 'planting')];
		case 'cloud':
			return [-1, 1].map((s) =>
				bulb([x + s * r * 0.32, y, z + 0.5 * r + s * 0.19], 0.76 * r, 0.85, 'planting')
			);
		case 'fork':
			return [-1, 1].flatMap((s) => [
				bulb([x + s * r * 0.38, y, z + 0.62 * r], 0.53 * r, 1.45, 'planting')
			]);
		case 'umbrella':
			return [cap([x, y, z], r, 0.45 * r, 'planting')];
		case 'rock':
			return [
				{
					...surface('foot'),
					kind: 'dome',
					position: [x, y, z],
					radius: r,
					height: 1.1 * r,
					facets: 1
				}
			];
	}
}
function grove(type: Plant) {
	return garden(
		type + '-roof-grove',
		type === 'rock' ? ['foot', 'planting'] : ['foot', 'slats', 'planting'],
		(w) => w,
		(w, v, s) => {
			const r = w * (v === 0 ? 0.33 : 0.2),
				n = v + 1,
				centres = n === 1 ? [[0, 0]] : circle(w * 0.23, n);
			return [
				panel(0, 0, 0, w, w, 0.35, 'foot'),
				panel(0, 0, 0.35, w - 0.32, w - 0.32, 0.22, 'planting'),
				...centres.flatMap(([x, y], i) => {
					const h = (1.05 + 0.24 * i + 0.16 * s) * r;
					return type === 'rock'
						? canopy(type, x, y, 0.53, r)
						: [
								drum([x, y, 0.56], Math.max(0.15, r * 0.14), h, 'slats'),
								...canopy(type, x, y, 0.56 + h, r)
							];
				})
			];
		}
	);
}
export const gardens = (
	['cube', 'cone', 'cloud', 'umbrella', 'cypress', 'fork', 'rock'] as const
).flatMap(grove);
