import type { TerrainCell } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';

/** Level court terrace on a surveyed bench, in world metres. */
export function courtLanding(
	cell: TerrainCell,
	bench = Math.max(...cell.corners.map((p) => p[2]))
) {
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
		position: [x, y, bench + 0.6] as Vec3,
		polygon: corners.map(([u, v]): [number, number] => [u, v]),
		area: Math.abs(area)
	};
}
