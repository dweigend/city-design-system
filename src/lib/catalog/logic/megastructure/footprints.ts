import { area, orient, validateRing, type Vec } from '../parametrik/raster/universal/kern';
export type RoofCell = {
	id: string;
	height: number;
	polygon: readonly (readonly [number, number])[];
};

/** CCW wall corners starting at the lexicographically smallest (x, y). */
function normalizeRoofRing(ring: readonly Vec[]) {
	const ccw = area(ring) < 0 ? [...ring].reverse() : ring;
	validateRing(ccw);
	const corners = ccw.filter((point, i) => {
		const previous = ccw[(i + ccw.length - 1) % ccw.length],
			next = ccw[(i + 1) % ccw.length];
		const turn = orient(previous, point, next);
		if (turn < 0) throw new RangeError('Nonconvex roof footprint');
		return turn !== 0;
	});
	const start = corners.reduce((first, [x, y], i) => {
		const [fx, fy] = corners[first];
		return x < fx || (x === fx && y < fy) ? i : first;
	}, 0);
	return [...corners.slice(start), ...corners.slice(0, start)];
}
// For convex rings a supporting wall of either ring separates disjoint interiors.
// All vertices on the exterior or on the line allow point and edge contact.
function separatingWall(ring: readonly Vec[], other: readonly Vec[]) {
	const sign = orient(ring[0], ring[1], ring[2]);
	return ring.some((a, i) =>
		other.every((p) => sign * orient(a, ring[(i + 1) % ring.length], p) <= 0)
	);
}
/** Validates each surveyed roof and returns fresh rings with straight wall runs merged.
 * Strict interior overlap is invalid even at different roof heights. */
export function surveyedRoofs(roofs: readonly RoofCell[]) {
	const result = roofs.map((roof) => {
		if (!Number.isFinite(roof.height)) throw new RangeError('Invalid roof height');
		return { ...roof, polygon: normalizeRoofRing(roof.polygon) };
	});
	for (const [i, a] of result.entries())
		for (const b of result.slice(i + 1)) {
			if (!separatingWall(a.polygon, b.polygon) && !separatingWall(b.polygon, a.polygon))
				throw new RangeError('Overlapping roof footprints');
		}
	return result;
}
