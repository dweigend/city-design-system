import type { ObjectGeometry } from './object-geometry';
import { mount, type AssetRecipe } from './definition';
import { slab, ring, surface, bulb } from './parts';
import type { Vec3 } from '../parametrik/types';
function ellipse(
	x: number,
	z: number,
	w: number,
	h: number,
	inner: number,
	slot: string
): ObjectGeometry {
	const points: Vec3[] = [],
		triangles: number[] = [],
		lines: number[][] = [];
	const n = 48;
	for (const depth of [0, 0.07])
		for (const scale of inner ? [1, inner] : [1]) {
			const loop: number[] = [];
			for (let i = 0; i < n; i++) {
				const angle = (i * 2 * Math.PI) / n;
				loop.push(points.length);
				points.push([x + depth, w * scale * Math.cos(angle), z + h * scale * Math.sin(angle)]);
			}
			lines.push([...loop, loop[0]]);
		}
	triangulateEllipse(triangles, n, inner);

	return { ...surface(slot), kind: 'mesh', points, triangles, lines };
}
function triangulateEllipse(triangles: number[], n: number, inner: number) {
	const front = inner ? 2 * n : n;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		triangles.push(i, j, front + j, i, front + j, front + i);
		if (inner) {
			triangles.push(front + i, front + j, front + n + j, front + i, front + n + j, front + n + i);
			triangles.push(
				i,
				n + j,
				j,
				i,
				n + i,
				n + j,
				n + i,
				front + n + i,
				front + n + j,
				n + i,
				front + n + j,
				n + j
			);
		} else if (i > 0 && i < n - 1) triangles.push(0, j, i, front, front + i, front + j);
	}
}

export const porthole: AssetRecipe = {
	id: 'porthole',
	slotNames: ['body', 'glass', 'accent'],
	category: 'facades',
	variants: ['round', 'oval', 'ringed', 'shuttered'],
	footprint: [0.48, 3.2],
	anchors: [mount('facade')],
	draw(variant, sample) {
		const r = 0.51 + 0.07 * sample;
		if (variant === 1)
			return [
				ellipse(0, r, r * 1.42, r, 0.85, 'body'),
				ellipse(0, r, r * 1.42 * 0.85, r * 0.85, 0, 'glass')
			];
		const parts: ObjectGeometry[] = [
			ring([0.09, 0, r], r, r * 0.82, 0.18),
			ring([0.09, 0, r], r * 0.835, 0, 0.075, 'glass')
		];
		for (let i = 0; i < 8; i++) {
			const angle = ((i + 0.5) * Math.PI) / 4;
			parts.push(
				bulb(
					[variant === 2 ? 0.22 : 0.18, r * 0.91 * Math.cos(angle), r + r * 0.91 * Math.sin(angle)],
					0.021,
					1,
					'accent'
				)
			);
		}
		if (variant === 2) parts.push(ring([0.19, 0, r], r * 0.95, r * 0.86, 0.06, 'accent'));
		if (variant === 3)
			parts.push(
				ring([0.09, r * 1.85, r], r * 0.86, 0, 0.12, 'accent'),
				slab([0, r * 0.81, r * 0.8], [0.2, r * 0.35, r * 0.32])
			);
		return parts;
	}
};
