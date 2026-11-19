import { mount, type AssetRecipe } from './definition';
import { slab, ring, surface, white, living, pane } from './parts';
import type { ColorToken, Primitive, Vec3 } from '../parametrik/types';
function ellipse(
	x: number,
	z: number,
	w: number,
	h: number,
	inner: number,
	token: ColorToken
): Primitive {
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
	return { ...surface(token), kind: 'mesh', points, triangles, lines };
}
export const porthole: AssetRecipe = {
	id: 'porthole',
	category: 'facades',
	variants: ['round', 'oval', 'ringed', 'shuttered'],
	footprint: [0.48, 3.2],
	anchors: [mount('facade')],
	draw(variant, sample) {
		const r = 0.51 + 0.07 * sample;
		if (variant === 1)
			return [
				ellipse(0, r, r * 1.42, r, 0.85, white),
				ellipse(0, r, r * 1.42 * 0.85, r * 0.85, 0, pane)
			];
		const parts: Primitive[] = [
			ring([0.09, 0, r], r, r * 0.82, 0.18),
			ring([0.09, 0, r], r * 0.835, 0, 0.075, pane)
		];
		if (variant === 2) parts.push(ring([0.19, 0, r], r * 0.95, r * 0.86, 0.06, living));
		if (variant === 3)
			parts.push(
				ring([0.09, r * 1.85, r], r * 0.86, 0, 0.12, living),
				slab([0, r * 0.81, r * 0.8], [0.2, r * 0.35, r * 0.32])
			);
		return parts;
	}
};
