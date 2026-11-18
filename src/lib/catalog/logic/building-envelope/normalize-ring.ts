import type { Point2 } from '../parametrik/vocab';
import { orient, onSegment, intersects } from '../parametrik/raster/universal/kern';
import { epsilon } from './precision';
function assertSimple(ring: Point2[]) {
	for (let i = 0; i < ring.length; i++) {
		const a = ring[i],
			b = ring[(i + 1) % ring.length],
			c = ring[(i + 2) % ring.length];
		if (onSegment(c, a, b) || onSegment(a, b, c))
			throw new RangeError('Self-intersecting footprint');
		for (let j = i + 2; j < ring.length; j++) {
			if (i === 0 && j === ring.length - 1) continue;
			if (intersects(a, b, ring[j], ring[(j + 1) % ring.length]))
				throw new RangeError('Self-intersecting footprint');
		}
	}
}

function compare(a: Point2, b: Point2) {
	return a[0] - b[0] || a[1] - b[1];
}
function startAtMinimum(points: Point2[]) {
	const i = points.reduce((best, p, j) => (compare(p, points[best]) < 0 ? j : best), 0);
	return points.slice(i).concat(points.slice(0, i));
}
function reverseCycle(cycle: Point2[]) {
	return [cycle[0], ...cycle.slice(1).reverse()];
}
function adjacentDistinct(points: Point2[], tolerance: number) {
	const ring: Point2[] = [];
	const near = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
	for (const p of points) if (!ring.length || !near(p, ring[ring.length - 1])) ring.push(p);
	while (ring.length > 1 && near(ring[0], ring[ring.length - 1])) ring.pop();
	return ring;
}
// Check betweenness as well as collinearity so a retraced wall remains invalid.
function wallCorners(ring: Point2[]) {
	return ring.filter(
		(p, i) => !onSegment(p, ring[(i + ring.length - 1) % ring.length], ring[(i + 1) % ring.length])
	);
}
/** Canonical simple ring: no wall subdivisions, lexicographically first corner, CCW winding. */
export function normalizeRing(points: readonly Point2[]): Point2[] {
	const copied = points.map(([x, y]): Point2 => {
		if (!Number.isFinite(x) || !Number.isFinite(y))
			throw new RangeError('Expected finite plan coordinates');
		return [x || 0, y || 0];
	});
	const cycle = startAtMinimum(wallCorners(adjacentDistinct(copied, 0)));
	if (cycle.length < 3) return [];
	// Only actual corners choose the traversal and therefore the survivor of a short edge.
	const traversal = compare(cycle[1], cycle[cycle.length - 1]) > 0 ? reverseCycle(cycle) : cycle;
	const ring = adjacentDistinct(traversal, epsilon);
	if (ring.length < 3 || ring.every((p) => orient(ring[0], ring[1], p) === 0)) return [];
	assertSimple(ring);
	const corners = startAtMinimum(wallCorners(ring));
	return orient(corners[corners.length - 1], corners[0], corners[1]) > 0
		? corners
		: reverseCycle(corners);
}
