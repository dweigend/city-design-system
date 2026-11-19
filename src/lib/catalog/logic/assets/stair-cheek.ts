import type { Vec3 } from '../parametrik/types';
import { surface } from './parts';

/** A solid stair stringer or windscreen between two elevations, centred on its transverse axis. */
export function stairCheek(
	x0: number,
	x1: number,
	y: number,
	z0: number,
	z1: number,
	height: number,
	thickness: number,
	slot: string
) {
	const points: Vec3[] = [];
	for (const side of [-1, 1]) {
		const axis = y + (side * thickness) / 2;
		points.push([x0, axis, z0], [x1, axis, z1], [x1, axis, z1 + height], [x0, axis, z0 + height]);
	}
	const triangles = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6];
	for (let i = 0; i < 4; i++) {
		const j = (i + 1) % 4;
		triangles.push(i, i + 4, j + 4, i, j + 4, j);
	}
	return { ...surface(slot), kind: 'mesh' as const, points, triangles, lines: [] };
}
