import { mount, type AssetRecipe } from './definition';
import { slab, ring, surface, white, living, pane } from './parts';
import type { ColorToken, Primitive, Vec3 } from '../parametrik/types';
function ellipse(x: number, w: number, h: number, rim: number, token: ColorToken): Primitive {
	const points: Vec3[] = [],
		triangles: number[] = [],
		lines: number[][] = [];
	const n = 48;
	for (const depth of [0, 0.06])
		for (const inset of [0, rim || Math.min(w, h) * 0.99]) {
			const loop: number[] = [];
			for (let i = 0; i < n; i++) {
				const angle = (i * 2 * Math.PI) / n;
				loop.push(points.length);
				points.push([x + depth, (w - inset) * Math.cos(angle), h + (h - inset) * Math.sin(angle)]);
			}
			lines.push([...loop, loop[0]]);
		}
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		for (const [a, b] of [
			[0, 2],
			[2, 3],
			[3, 1],
			[1, 0]
		])
			triangles.push(a * n + i, a * n + j, b * n + j, a * n + i, b * n + j, b * n + i);
	}
	if (!rim) {
		for (let i = 1; i < n - 1; i++) triangles.push(3 * n, 3 * n + i, 3 * n + i + 1);
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
			return [ellipse(0, r * 1.42, r, 0.09, white), ellipse(0.045, r * 1.21, r * 0.83, 0, pane)];
		const parts = [
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
