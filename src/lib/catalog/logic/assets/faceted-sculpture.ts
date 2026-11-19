import { mount, type AssetRecipe } from './definition';
import { surface, white, living } from './parts';
import type { ColorToken, Primitive, Vec3 } from '../parametrik/types';
function crystal(
	x: number,
	y: number,
	r: number,
	h: number,
	lean: number,
	token: ColorToken
): Primitive {
	const points: Vec3[] = [
			[x, y, 0],
			[x + lean, y, h]
		],
		triangles: number[] = [],
		lines: number[][] = [];
	for (let i = 0; i < 5; i++) {
		const t = (i * 2 * Math.PI) / 5;
		points.push([x + r * Math.cos(t), y + r * Math.sin(t), h * (0.3 + 0.08 * (i % 2))]);
	}
	for (let i = 0; i < 5; i++) {
		const j = 2 + i,
			k = 2 + ((i + 1) % 5);
		triangles.push(0, k, j, 1, j, k);
		lines.push([0, j, 1], [j, k]);
	}
	return { ...surface(token), kind: 'mesh', points, triangles, lines };
}
export const facetedSculpture: AssetRecipe = {
	id: 'faceted-sculpture',
	category: 'landmarks',
	variants: ['spire', 'fold', 'split-crystal'],
	footprint: [4.6, 4.6],
	anchors: [mount('deck'), mount('roof')],
	draw(variant, sample) {
		const h = [4.6, 2.8, 3.4][variant] + sample * 0.3;
		const parts = [
			crystal(
				variant === 2 ? -0.72 : 0,
				0,
				variant === 2 ? 0.88 : 1.42,
				h,
				variant === 1 ? 0.7 : 0.28,
				living
			)
		];
		if (variant === 2) parts.push(crystal(0.77, 0.12, 0.76, h * 0.71, -0.14, white));
		return parts;
	}
};
