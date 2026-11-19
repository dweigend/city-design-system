import type { Vec3 } from '../parametrik/types';
import { mount, type AssetRecipe } from './definition';
import { surface } from './parts';
import { joinRings } from '../profile-fit';

function frameReveal(
	points: Vec3[],
	triangles: number[],
	count: number,
	depth: number,
	height: number
) {
	points.push(
		...points.map(([x, y, z]): Vec3 => [0.1 * depth + 0.8 * x, y, 0.1 * height + 0.8 * z])
	);
	joinRings(triangles, 0, 2 * count, count);
	joinRings(triangles, 3 * count, count, count);
	joinRings(triangles, 2 * count, 3 * count, count);
}

function baySection(y: number, width: number, depth: number, height: number, slot: string) {
	const points: Vec3[] = [],
		triangles: number[] = [];
	const n = 36;
	for (const side of [-1, 1]) {
		points.push([0, y + (side * width) / 2, 0], [depth, y + (side * width) / 2, 0]);
		for (let i = 0; i <= n; i++) {
			const angle = (i * Math.PI) / (2 * n);
			points.push([
				depth * Math.cos(angle),
				y + (side * width) / 2,
				height * (0.34 + 0.66 * Math.sin(angle))
			]);
		}
	}
	const count = n + 3;
	joinRings(triangles, count, 0, count);
	if (slot === 'body') frameReveal(points, triangles, count, depth, height);
	else
		for (let i = 1; i < count - 1; i++)
			triangles.push(0, i, i + 1, count, count + i + 1, count + i);
	return { ...surface(slot), kind: 'mesh' as const, points, triangles, lines: [] };
}

export const bayWindow: AssetRecipe = {
	id: 'bay-window',
	slotNames: ['body', 'glass'],
	category: 'facades',
	variants: ['canted', 'wide', 'deep'],
	footprint: [1.6, 4.8],
	anchors: [mount('facade')],
	draw(variant, sample) {
		const depth = [0.88, 0.74, 1.46][variant],
			width = [2.8, 4.6, 3.15][variant],
			height = 1.25 + 0.15 * sample;
		const bays = [2, 4, 3][variant],
			pitch = (width - 0.15) / bays;
		return [
			baySection(0, width - 0.15, depth - 0.055, height - 0.055, 'glass'),
			...Array.from({ length: bays + 1 }, (_, i) =>
				baySection((i - bays / 2) * pitch, 0.15, depth, height, 'body')
			)
		];
	}
};
