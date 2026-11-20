import { houseStair } from '../../data/house-stair';
import type { QuadCell } from '../quad-grid';

export const entranceHeadroom = 2.1;
export const landingDepth = 0.41;
export const approachDepth = houseStair.width / 2 + 0.02;
const ladderLane = houseStair.compactLadderWidth;

/** Fits a single straight ladder in a one-storey bay too narrow for two separate approaches. */
export function entranceLayout(width: number, stories: number) {
	const sideLadder = stories === 1 && width < 2 * (houseStair.width + ladderLane);
	const laneOffset = sideLadder ? 0 : ladderLane / 2;
	const clearance = ladderLane + 2 * (laneOffset + 0.06 + 0.05);
	return {
		sideLadder,
		wellWidth: sideLadder ? 2 * landingDepth : clearance,
		wellDepth: sideLadder ? clearance : 2 * landingDepth,
		approachHalfWidth: houseStair.width / 2 + laneOffset + 0.02
	};
}

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

/** Whether a neighbouring cell can cross the same ground approach on an oblique parcel. */
export function crossesApproach(
	cell: QuadCell,
	axis: XY,
	sign: number,
	rearDepth: number,
	approachHalfWidth: number
) {
	const xs = cell.corners.map((p) => p[0]);
	return (
		Math.max(...xs) > axis[0] - approachHalfWidth &&
		Math.min(...xs) < axis[0] + approachHalfWidth &&
		cell.corners.some((p) => sign * (p[1] - axis[1]) > -rearDepth)
	);
}

/** Opens the entrance cell from its exterior face to the ladder, retaining two piers and the rear room. */
export function entranceRooms(
	cell: QuadCell,
	axis: XY,
	sign: number,
	rearDepth: number,
	approachHalfWidth: number
) {
	const ring = cell.corners.map(([x, y]): XY => [x, y]);
	const left = axis[0] - approachHalfWidth,
		right = axis[0] + approachHalfWidth;
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

/** Reserves the ground approach from the parcel face to the ladder feet, in world metres. */
export function groundApproach(
	cells: readonly QuadCell[],
	axis: XY,
	sign: number,
	bottom: number,
	floor: number,
	approachHalfWidth: number
) {
	const half = approachHalfWidth;
	const outer = sign * Math.max(...cells.flatMap((c) => c.corners.map((p) => sign * p[1])));
	const inner = axis[1] - sign * approachDepth;
	return {
		min: [axis[0] - half, Math.min(inner, outer), bottom] as [number, number, number],
		max: [axis[0] + half, Math.max(inner, outer), floor + entranceHeadroom] as [
			number,
			number,
			number
		]
	};
}
