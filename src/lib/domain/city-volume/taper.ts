import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { PlaneRule } from './plane-lattice';

/** Horizontal meters a corner moves per level above the lowest column around it. */
export const taperStep = 5;
/** Largest move as a share of the corner's distance to the centre of the columns it carries. */
const taperCap = 0.4;

/** Moves a corner by `sign × taperStep` per level above the lowest column around it, along the
 * line to the mean centre of the columns that still reach that level. Open plan edges count as
 * ground. Sign 1 steps back toward the taller columns, sign −1 cantilevers over the lower ones. */
export function taper(sign: 1 | -1): PlaneRule['shift'] {
	return ({ columns, centres }, { corner, cells, interior }, level): Vec2 => {
		const levels = (cell: string) => required(columns.get(cell), 'taper column').levels;
		const depth = level - (interior ? Math.min(...cells.map(levels)) : 0);
		const carried = cells.filter((cell) => levels(cell) >= level);
		if (depth <= 0 || !carried.length) return [0, 0];
		const [x, y] = carried
			.map((cell) => required(centres.get(cell), 'taper centre'))
			.reduce(([a, b], [u, v]) => [a + u / carried.length, b + v / carried.length], [0, 0]);
		const [dx, dy] = [x - corner.position[0], y - corner.position[1]];
		const reach = Math.hypot(dx, dy);
		// Columns that only touch diagonally across the corner give it no direction.
		if (reach < 1e-6) return [0, 0];
		const move = (sign * Math.min(taperStep * depth, taperCap * reach)) / reach;
		return [dx * move, dy * move];
	};
}
