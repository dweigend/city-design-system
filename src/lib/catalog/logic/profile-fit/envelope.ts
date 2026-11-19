import type { Vec3 } from '../parametrik/types';
type LimitPlane = { normal: Vec3; distance: number };

/** Largest uniform scale about a fixed anchor satisfying the supplied local half-spaces.
 * Each normal points outward. Its distance and the support function use the same normal scale.
 * An anchor outside the envelope has no admissible fit. */
export function fitScale(
	planes: readonly LimitPlane[],
	support: (normal: Vec3) => number,
	maximum: number
) {
	if (!Number.isFinite(maximum) || maximum <= 0)
		throw new RangeError('Expected a finite positive scale');
	let scale = maximum;
	for (const { normal, distance } of planes) {
		if (!Number.isFinite(distance) || !normal.every(Number.isFinite) || !Math.hypot(...normal))
			throw new RangeError('Invalid limit plane');
		if (distance < 0) return 0;
		const extent = support(normal);
		if (!Number.isFinite(extent)) throw new RangeError('Invalid support extent');
		if (extent > 0) scale = Math.min(scale, distance / extent);
	}
	return Math.max(0, scale);
}

/** Vertical boundary planes of an ordered convex footprint relative to a world-space anchor. */
export function footprintPlanes(corners: readonly Vec3[], anchor: Vec3): LimitPlane[] {
	const area = corners.reduce((total, [x, y], i) => {
		const b = corners[(i + 1) % corners.length];
		return total + x * b[1] - y * b[0];
	}, 0);
	if (!area) throw new RangeError('Expected a convex footprint with positive area');
	const sign = Math.sign(area);
	return corners.map(([x, y], i) => {
		const b = corners[(i + 1) % corners.length],
			nx = sign * (b[1] - y),
			ny = sign * (x - b[0]),
			length = Math.hypot(nx, ny);
		if (!length) throw new RangeError('Coincident footprint corners');
		return {
			normal: [nx / length, ny / length, 0],
			distance: ((x - anchor[0]) * nx + (y - anchor[1]) * ny) / length
		};
	});
}
