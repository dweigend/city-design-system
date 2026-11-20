import type { Vec3 } from '../parametrik/types';
import type { Point2 } from '../parametrik/vocab';
import type { QuadCell } from './carrier';
type Side = {
	from: Vec3;
	to: Vec3;
	fromId: string;
	toId: string;
	cellId: string;
	index: number;
	used: boolean;
};

/** Unit plan direction from a to b, or zero for coincident points. */
export const direction = (a: Point2 | Vec3, b: Point2 | Vec3): Point2 => {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const length = Math.hypot(dx, dy) || 1;
	return [dx / length, dy / length];
};
/** Signed turn from direction a to direction b, radians, positive to the left. */
export const turn = (a: Point2, b: Point2) =>
	Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);

function boundarySides(cells: readonly QuadCell[], isMember: (cellId: string) => boolean): Side[] {
	const sides: Side[] = [];
	for (const cell of cells)
		cell.neighbors.forEach((neighborId, i) => {
			if (neighborId !== null && isMember(neighborId)) return;
			const next = (i + 1) % 4;
			sides.push({
				from: cell.corners[i],
				cellId: cell.id,
				index: i,
				to: cell.corners[next],
				fromId: cell.vertexIds[i],
				toId: cell.vertexIds[next],
				used: false
			});
		});
	return sides;
}

/**
 * Next side at a shared corner: the sharpest left turn stays with the same cell, so rings
 * that touch at one corner never cross each other.
 */
function nextSide(current: Side, candidates: readonly Side[]): Side | undefined {
	const heading = direction(current.from, current.to);
	let best: Side | undefined;
	let bestTurn = -Infinity;
	for (const side of candidates) {
		if (side.used) continue;
		const angle = turn(heading, direction(side.from, side.to));
		if (angle > bestTurn) {
			bestTurn = angle;
			best = side;
		}
	}
	return best;
}

/**
 * Boundary rings of a cell set, traced along shared corner identities (never along rounded
 * coordinates). Order: by the first boundary side in cell order. Detached points.
 * @param isMember true for cell ids inside the set
 */
export function boundaryRings(
	cells: readonly QuadCell[],
	isMember: (cellId: string) => boolean
): Point2[][] {
	return boundaryRuns(cells, isMember).map((run) => run.map(({ from: [x, y] }) => [x, y]));
}

/** Traces each boundary in cell order with the surveyed side address retained for every segment. */
export function boundaryRuns(cells: readonly QuadCell[], isMember: (cellId: string) => boolean) {
	const sides = boundarySides(cells, isMember);
	const leaving = new Map<string, Side[]>();
	for (const side of sides) leaving.set(side.fromId, [...(leaving.get(side.fromId) ?? []), side]);
	const rings: Side[][] = [];
	for (const start of sides) {
		if (start.used) continue;
		const ring: Side[] = [];
		let side: Side | undefined = start;
		while (side) {
			side.used = true;
			ring.push(side);
			side = nextSide(side, leaving.get(side.toId) ?? []);
		}
		rings.push(ring);
	}
	return rings;
}

/** Signed area in m²: positive for counter-clockwise rings. */
export function ringArea(ring: readonly Point2[]): number {
	let twice = 0;
	ring.forEach((a, i) => {
		const b = ring[(i + 1) % ring.length];
		twice += a[0] * b[1] - b[0] * a[1];
	});
	return twice / 2;
}
