import { houseStair } from '../../data/house-stair';
import type { Network, NetworkInput } from '../walkway-network';
import type { Vec3 } from '../parametrik/types';

/** Lay the public wearing surface one tread thickness above the grid triangles.
 * Crossfall follows the terrain on both sides of a ground strip. */
export function groundDeck<T extends Network>(network: T, terrain: NetworkInput['terrain']) {
	const top = (x: number, y: number) => terrain(x, y) + houseStair.thickness;
	const geometry = network.geometry.map((shape) => {
		if (shape.kind === 'mesh' && !shape.id.endsWith('/ramp')) {
			const points = shape.points.map(([x, y]): Vec3 => [x, y, top(x, y)]);
			return {
				...shape,
				points,
				lines: [
					[0, 3],
					[1, 2]
				]
			};
		}
		if (shape.kind === 'cylinder' && shape.slot === 'deck') {
			const [x, y, z] = shape.position;
			return { ...shape, position: [x, y, z + houseStair.thickness] as Vec3 };
		}
		return shape;
	});
	if (geometry.some((p) => p.kind === 'mesh' && p.points.some((q) => !Number.isFinite(q[2]))))
		return;
	return { ...network, geometry };
}
