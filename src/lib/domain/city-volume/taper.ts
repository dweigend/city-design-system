import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { PlaneRule } from './plane-joints';
import type { PlanRing, PlanTopology } from './plan-topology';

/** Horizontal meters a corner moves per level above the lowest column around it. */
export const taperStep = 5;
/** Largest move as a share of the corner's distance to the centre of the columns it carries. */
const taperCap = 0.4;

/** Keeps both endpoints of every incident centre-fan triangle on its original side.
 * Each can move at most a third of the smaller endpoint altitude. The two linear
 * terms and the quadratic term can then change less than the original signed area. */
function cornerClearance({ columns, centres }: PlanTopology, { corner, cells }: PlanRing) {
	let clearance = Infinity;
	for (const id of cells) {
		const { corners } = required(columns.get(id), 'taper column');
		const [cx, cy] = required(centres.get(id), 'taper centre');
		const i = corners.findIndex(({ id }) => id === corner.id);
		const [ax, ay] = corner.position;
		const a = Math.hypot(ax - cx, ay - cy);
		for (const j of [(i + corners.length - 1) % corners.length, (i + 1) % corners.length]) {
			const [bx, by] = corners[j].position;
			const area2 = Math.abs((ax - cx) * (by - cy) - (ay - cy) * (bx - cx));
			const altitude = area2 / Math.max(a, Math.hypot(bx - cx, by - cy));
			clearance = Math.min(clearance, altitude / 3);
		}
	}
	return clearance;
}

/** Moves a corner by `sign × taperStep` per level above the lowest column around it, along the
 * line to the mean centre of the columns that still reach that level. Open plan edges count as
 * the foundation cap. Sign 1 steps back toward the taller columns, sign −1 cantilevers over the lower ones. */
export function taper(sign: 1 | -1): NonNullable<PlaneRule['shift']> {
	return (topology, bands) => {
		const clearances = new Map<string, number>();
		return (ring, level): Vec2 => {
			const { corner, cells, interior } = ring;
			const { centres } = topology;
			const base = Math.max(...cells.map((cell) => bands(cell).foundation));
			if (level <= base) return [0, 0];
			const levels = (cell: string) => bands(cell).roof;
			const depth = level - (interior ? Math.min(...cells.map(levels)) : base);
			const carried = cells.filter((cell) => levels(cell) >= level);
			if (depth <= 0 || !carried.length) return [0, 0];
			const [x, y] = carried
				.map((cell) => required(centres.get(cell), 'taper centre'))
				.reduce(([a, b], [u, v]) => [a + u / carried.length, b + v / carried.length], [0, 0]);
			const [dx, dy] = [x - corner.position[0], y - corner.position[1]];
			const reach = Math.hypot(dx, dy);
			// Columns that only touch diagonally across the corner give it no direction.
			if (reach < 1e-6) return [0, 0];
			let clearance = clearances.get(corner.id);
			if (clearance === undefined) {
				clearance = cornerClearance(topology, ring);
				clearances.set(corner.id, clearance);
			}
			const move = (sign * Math.min(taperStep * depth, taperCap * reach, clearance)) / reach;
			return [dx * move, dy * move];
		};
	};
}
