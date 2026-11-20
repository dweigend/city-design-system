import { houseStair } from '../../data/house-stair';
import type { QuadCell } from '../quad-grid';

// Two offset 0.48 m ladder lanes, 0.06 m stiles and 0.05 m clear on each side.
export const entranceWidth = 1.18;
export const landingDepth = 0.41;
export const approachDepth = houseStair.width / 2 + 0.02;

type XY = [number, number];
/** Keeps the part of a convex ring on the positive side of a signed line. */
function clip(ring: XY[], distance: (point: XY) => number) {
	return ring.flatMap((p, i) => {
		const next = ring[(i + 1) % ring.length];
		const u = distance(p),
			v = distance(next);
		const keep = u >= 0 ? [p] : [];
		if (u * v >= 0) return keep;
		const t = u / (u - v);
		return [...keep, [p[0] + t * (next[0] - p[0]), p[1] + t * (next[1] - p[1])] as XY];
	});
}

/** Opens the entrance cell from its exterior face to the ladder, retaining two piers and the rear room. */
export function entranceRooms(cell: QuadCell, axis: XY, sign: number, rearDepth: number) {
	const ring = cell.corners.map(([x, y]): XY => [x, y]);
	// The public approach reaches either staggered ladder foot with its full walking width.
	const half = houseStair.width / 2 + 0.24 + 0.02;
	const left = axis[0] - half,
		right = axis[0] + half;
	const middle = clip(
		clip(ring, ([x]) => x - left),
		([x]) => right - x
	);
	return [
		clip(ring, ([x]) => left - x),
		clip(ring, ([x]) => x - right),
		clip(middle, ([, y]) => sign * (axis[1] - y) - rearDepth)
	]
		.filter((r) => r.length >= 3)
		.map((polygon) => ({ polygon, holes: [] as XY[][] }));
}

/** Chooses a tower cell with a street-facing entry along the selected ladder axis. */
export function entranceCell(
	cells: readonly QuadCell[],
	frontage: ReadonlySet<string>,
	sign: number
) {
	const occupied = new Set([...cells.map((c) => c.id), ...frontage]);
	function exposure(cell: QuadCell) {
		return Math.max(
			0,
			...cell.corners.map(([x, y], i) => {
				const neighbor = cell.neighbors[i];
				if (neighbor && occupied.has(neighbor)) return 0;
				const [u, v] = cell.corners[(i + 1) % 4];
				return (sign * (x - u)) / Math.hypot(x - u, y - v);
			})
		);
	}
	return cells.reduce((best, c) => (exposure(c) > exposure(best) ? c : best));
}
