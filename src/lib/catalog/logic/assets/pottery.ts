import type { ColorToken, Primitive, Vec3 } from '../parametrik/types';
import { surface } from './parts';

/** Fires a completed primitive with the catalogue's glazed ceramic finish. */
export function glaze(part: Primitive): Primitive {
	return { ...part, material: 'glaze', finish: 'keramik-glasiert' };
}

/** Turns the outside profile, lip, inside wall and recessed well of a vessel.
 * Pairs are [radius, height] in metres, ordered from foot to mouth. Twist is radians per metre. */
export function vessel(
	profile: [number, number][],
	sides: number,
	heightScale: number,
	token: ColorToken,
	twist = 0
): Primitive {
	const wall = Math.min(0.09, ...profile.map(([r]) => r * 0.2));
	const inside = profile
		.map(([r, z]): [number, number] => [r - wall, Math.max(z, profile[0][1] + wall)])
		.reverse();
	const contour = [...profile, ...inside];
	const points: Vec3[] = [],
		triangles: number[] = [],
		lines: number[][] = [];
	for (const [r, z] of contour) {
		const start = points.length;
		for (let j = 0; j < sides; j++) {
			const a = (j * 2 * Math.PI) / sides + twist * z;
			points.push([r * Math.cos(a), r * Math.sin(a), z * heightScale]);
		}
		lines.push([...Array.from({ length: sides }, (_, j) => start + j), start]);
	}
	for (let k = 0; k < contour.length - 1; k++)
		for (let j = 0; j < sides; j++) {
			const a = k * sides + j,
				b = k * sides + ((j + 1) % sides);
			triangles.push(a, b, b + sides, a, b + sides, a + sides);
		}
	const end = (contour.length - 1) * sides;
	for (let j = 1; j < sides - 1; j++) triangles.push(0, j + 1, j, end, end + j, end + j + 1);
	return {
		...surface(token, 'glaze'),
		finish: 'keramik-glasiert',
		kind: 'mesh',
		points,
		triangles,
		lines
	};
}
