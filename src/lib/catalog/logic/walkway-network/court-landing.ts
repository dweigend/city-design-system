import type { TerrainCell } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';

/** Level court terrace just above its highest corner, in world metres. */
export function courtLanding(cell: TerrainCell) {
	const {
		corners,
		center: [x, y]
	} = cell;
	const area =
		corners.reduce((sum, p, i) => {
			const q = corners[(i + 1) % 4];
			return sum + p[0] * q[1] - p[1] * q[0];
		}, 0) / 2;
	return {
		id: cell.id,
		position: [x, y, Math.max(...corners.map((p) => p[2])) + 0.6] as Vec3,
		polygon: corners.map(([u, v]): [number, number] => [u, v]),
		area: Math.abs(area)
	};
}
