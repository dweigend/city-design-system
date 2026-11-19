import type { Surface } from './surfaces';
import type { Vec3 } from '../parametrik/types';
import { piece } from './parts';
/** One space frame with continuous chords and opposing diagonals in each face panel. */
export function lattice(
	id: string,
	position: Vec3,
	side: number,
	height: number,
	surface: Surface
) {
	const [x, y, z] = position,
		n = Math.max(2, Math.round(height / (side * 1.8)));
	const at = (i: number, k: number): Vec3 => [
		x + (i === 1 || i === 2 ? side : 0),
		y + (i >= 2 ? side : 0),
		z + (height * k) / n
	];
	const members: [Vec3, Vec3][] = [];
	for (let face = 0; face < 4; face++) {
		const next = (face + 1) % 4;
		members.push([at(face, 0), at(face, n)]);
		for (let k = 0; k < n; k++)
			members.push(
				[at(face, k), at(next, k + 1)],
				[at(next, k), at(face, k + 1)],
				[at(face, k), at(next, k)]
			);
	}
	return piece(
		id,
		{
			kind: 'frame',
			position,
			size: [side, side, height],
			cells: [1, 1, n],
			members,
			bar: side * 0.073
		},
		surface
	);
}
