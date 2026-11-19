import type { ObjectGeometry } from './object-geometry';
import { mount, type AssetRecipe } from './definition';
import { drum, rod, ring, surface } from './parts';
import type { Vec3 } from '../parametrik/types';
function blade(h: number, r: number, a: number, width: number): ObjectGeometry {
	const outline = [
		[0.12, -0.06],
		[r * 0.53, -width * 0.25],
		[r, 0.05],
		[r * 0.88, width],
		[r * 0.44, width * 0.8]
	];
	const points = outline.map(([length, w]): Vec3 => [
		0.49,
		length * Math.cos(a) - w * Math.sin(a),
		h + length * Math.sin(a) + w * Math.cos(a)
	]);
	return {
		...surface('highlight'),
		kind: 'mesh',
		points,
		triangles: [0, 1, 4, 1, 2, 3, 1, 3, 4, 4, 1, 0, 3, 2, 1, 4, 3, 1],
		lines: [[0, 1, 2, 3, 4, 0]]
	};
}
export const windmill: AssetRecipe = {
	id: 'windmill',
	slotNames: ['body', 'highlight'],
	category: 'infrastructure',
	variants: ['three-blade', 'four-sail', 'wind-pump'],
	footprint: [4, 6.9],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const n = [3, 4, 8][variant],
			r = [2.98, 2.38, 1.64][variant],
			h = r + 2.45,
			offset = (sample * Math.PI) / n;
		const parts = [
			drum([0, 0, 0], 0.52, 0.23),
			{
				...surface(),
				kind: 'cone' as const,
				position: [0, 0, 0.23] as Vec3,
				radius: 0.38,
				height: h + 0.35
			},
			rod([0, 0, h], [0.56, 0, h], 0.16)
		];
		for (let i = 0; i < n; i++)
			parts.push(blade(h, r, (i * 2 * Math.PI) / n + offset, n === 8 ? 0.55 : 0.34));
		parts.push(ring([0.61, 0, h], 0.23, 0, 0.22, 'highlight'));
		return parts;
	}
};
