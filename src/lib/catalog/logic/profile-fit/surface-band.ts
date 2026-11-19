import { joinRings } from './strip';
import type { MeshForm, Vec3 } from '../parametrik/types';
import { kreisSegmente } from '../parametrik/rundung';

/** Outward depth of a capsule skin over its axial tangent plane. A zero half-span gives a sphere.
 * Returns undefined beyond the silhouette. Coordinates and the result are in metres. */
export function capsuleSkin(radius: number, halfSpan: number, axial: number, transverse: number) {
	if (![radius, halfSpan, axial, transverse].every(Number.isFinite) || radius <= 0 || halfSpan < 0)
		throw new RangeError('Invalid capsule section');
	const overhang = Math.max(0, Math.abs(axial) - halfSpan);
	const squared = radius * radius - overhang * overhang - transverse * transverse;
	return squared >= 0 ? Math.sqrt(squared) : undefined;
}

/** Closed annular trim following a host's surface chart, in metres. The chart's two tangent
 * axes cross toward the exterior. Its third argument offsets the point toward that exterior. */
export function surfaceBand(
	inner: number,
	outer: number,
	back: number,
	front: number,
	pointAt: (u: number, v: number, offset: number) => Vec3
): MeshForm {
	if (
		![inner, outer, back, front].every(Number.isFinite) ||
		inner <= 0 ||
		outer <= inner ||
		front <= back
	)
		throw new RangeError('Invalid trim section');
	const count = kreisSegmente(outer),
		points: Vec3[] = [],
		triangles: number[] = [];
	const loops = [
		[outer, back],
		[outer, front],
		[inner, front],
		[inner, back]
	];
	for (const [radius, offset] of loops) {
		for (let j = 0; j < count; j++) {
			const angle = (2 * Math.PI * j) / count;
			points.push(pointAt(radius * Math.cos(angle), radius * Math.sin(angle), offset));
		}
	}
	for (let i = 0; i < loops.length; i++) {
		const next = (i + 1) % loops.length;
		joinRings(triangles, i * count, next * count, count);
	}
	const lines = [1, 2].map((i) =>
		Array.from({ length: count + 1 }, (_, j) => i * count + (j % count))
	);
	return { kind: 'mesh', points, triangles, lines };
}
