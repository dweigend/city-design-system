/**
 * Outline of a set of grid cells as rounded rings: the soft, ceramic footprint of a mass.
 * Rings keep the solid on their left: the outer ring runs counter-clockwise, courtyards clockwise.
 */
import { direction, turn } from '../quad-grid';
export { boundaryRings, boundaryRuns, ringArea } from '../quad-grid';
import type { Point2 } from '../parametrik/vocab';

/** Turn in radians below which a ring vertex counts as a straight run and stays unrounded. */
const MIN_TURN = 0.5;
/** Largest share of an adjacent side a fillet may consume. */
const FILLET_SHARE = 0.46;
const ARC_SEGMENTS = { convex: 5, concave: 3 };
/** Lower bound for the miter denominator: caps the inset at sharp corners. */
const MITER_LIMIT = 0.35;

export type Fillet = Readonly<{ convex: number; concave: number }>;

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

/** Intersects adjacent offset sides with separate inward margins in meters. */
export function insetSides(ring: readonly Point2[], margins: readonly number[]): Point2[] {
	return ring.map(([x, y], i) => {
		const previous = (i + ring.length - 1) % ring.length;
		const [ax, ay] = direction(ring[previous], ring[i]);
		const [bx, by] = direction(ring[i], ring[(i + 1) % ring.length]);
		const before = margins[previous],
			after = margins[i];
		const cross = ax * by - ay * bx;
		if (Math.abs(cross) < 0.1) return [x - by * after, y + bx * after];
		const along = (before * (ax * bx + ay * by) - after) / cross;
		const reach = Math.max(
			-Math.abs(before - after) - Math.abs(before + after),
			Math.min(Math.abs(before - after) + Math.abs(before + after), along)
		);
		return [x - ay * before + ax * reach, y + ax * before + ay * reach];
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
