/**
 * Outline of a set of grid cells as rounded rings: the soft, ceramic footprint of a mass.
 * Rings keep the solid on their left: the outer ring runs counter-clockwise, courtyards clockwise.
 */
import type { Vec3 } from '../parametrik/types';
import type { Point2 } from '../parametrik/vocab';
import type { QuadCell } from '../quad-grid';

/** Turn in radians below which a ring vertex counts as a straight run and stays unrounded. */
const MIN_TURN = 0.5;
/** Largest share of an adjacent side a fillet may consume. */
const FILLET_SHARE = 0.46;
const ARC_SEGMENTS = { convex: 5, concave: 3 };
/** Lower bound for the miter denominator: caps the inset at sharp corners. */
const MITER_LIMIT = 0.35;

export type Fillet = Readonly<{ convex: number; concave: number }>;

type Side = {
	from: Vec3;
	to: Vec3;
	fromId: string;
	toId: string;
	cellId: string;
	index: number;
	used: boolean;
};

const direction = (a: Point2 | Vec3, b: Point2 | Vec3): Point2 => {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const length = Math.hypot(dx, dy) || 1;
	return [dx / length, dy / length];
};
/** Signed turn from direction a to direction b, radians, positive to the left. */
const turn = (a: Point2, b: Point2) =>
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

/** Moves a ring by `margin` meters toward its solid side (mitered, capped at sharp corners). */
export function insetRing(ring: readonly Point2[], margin: number): Point2[] {
	return ring.map((vertex, i) => {
		const into = direction(ring[(i + ring.length - 1) % ring.length], vertex);
		const out = direction(vertex, ring[(i + 1) % ring.length]);
		const bisector = direction([0, 0], [-into[1] - out[1], into[0] + out[0]]);
		const cosine = Math.max(MITER_LIMIT, bisector[0] * -into[1] + bisector[1] * into[0]);
		return [
			vertex[0] + (bisector[0] * margin) / cosine,
			vertex[1] + (bisector[1] * margin) / cosine
		];
	});
}

function arc(vertex: Point2, into: Point2, angle: number, radius: number): Point2[] {
	const left = Math.sign(angle);
	const reach = radius * Math.tan(Math.abs(angle) / 2);
	const start: Point2 = [vertex[0] - into[0] * reach, vertex[1] - into[1] * reach];
	const center: Point2 = [start[0] - into[1] * radius * left, start[1] + into[0] * radius * left];
	const from = Math.atan2(start[1] - center[1], start[0] - center[0]);
	const segments = angle > 0 ? ARC_SEGMENTS.convex : ARC_SEGMENTS.concave;
	return Array.from({ length: segments + 1 }, (_, k): Point2 => {
		const a = from + (angle * k) / segments;
		return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
	});
}

/**
 * Replaces every real corner of a ring by a circular fillet. Left turns are convex corners
 * of the solid. Radii in meters; a fillet shrinks where its sides are short.
 */
export function roundRing(ring: readonly Point2[], fillet: Fillet): Point2[] {
	return roundRingCorners(ring, fillet).flat();
}

/** Fillet samples grouped by the source vertices, in the original ring order. */
export function roundRingCorners(ring: readonly Point2[], fillet: Fillet): Point2[][] {
	return ring.map((vertex, i) => {
		const before = ring[(i + ring.length - 1) % ring.length];
		const after = ring[(i + 1) % ring.length];
		const into = direction(before, vertex);
		const angle = turn(into, direction(vertex, after));
		if (Math.abs(angle) < MIN_TURN) return [vertex];
		const shortest = Math.min(
			Math.hypot(vertex[0] - before[0], vertex[1] - before[1]),
			Math.hypot(after[0] - vertex[0], after[1] - vertex[1])
		);
		const wanted = angle > 0 ? fillet.convex : fillet.concave;
		if (wanted === 0) return [vertex];
		const radius = Math.min(wanted, (shortest * FILLET_SHARE) / Math.tan(Math.abs(angle) / 2));
		return arc(vertex, into, angle, radius);
	});
}
