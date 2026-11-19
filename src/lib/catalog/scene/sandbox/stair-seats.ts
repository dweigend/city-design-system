import { surveyGround } from '../../logic/structural-joints';
import type { Primitive } from '../../logic/parametrik/types';
import type { TerrainGrid } from '../../logic/terrain-grid';
import type { WashSeat } from './contact-wash';

/** Locates the low edge of each surveyed stair flight on the actual terrain triangles. */
export function stairSeats(parts: readonly Primitive[], grid: TerrainGrid): WashSeat[] {
	const seats: WashSeat[] = [];
	for (const p of parts) {
		if (!p.cityForm || p.kind !== 'prism') continue;
		const [a, b, c, d] = p.cityForm;
		const [l, r] = a[2] < d[2] ? [a, b] : [c, d];
		const x = (l[0] + r[0]) / 2,
			y = (l[1] + r[1]) / 2;
		const ground = surveyGround(grid, { point: [x, y, l[2] - 0.8], axis: [0, 0, 1], length: 1.6 });
		if (ground)
			seats.push({
				point: ground.point,
				normal: ground.supportNormal,
				diameter: Math.hypot(r[0] - l[0], r[1] - l[1])
			});
	}
	return seats;
}
