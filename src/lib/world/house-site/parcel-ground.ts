import { defaults } from '../../../config/house-site';
import { distance, type Vec2 } from '../../core/geometry';
import type { CellSpace } from '../../domain/cell-space';

const { groundSampleSpacingM } = defaults;

/** Samples the world-meter contour and a triangular mesh covering the convex cells. Returns
 * the lowest and highest sampled terrain levels in meters. */
// Exact arithmetic: barycentric coordinates across each triangle.
export function parcelGroundRange(
	space: CellSpace,
	outline: readonly Vec2[],
	groundAt: (point: Vec2) => number
) {
	let low = Infinity;
	let high = -Infinity;
	const sample = (point: Vec2) => {
		const z = groundAt(point);
		low = Math.min(low, z);
		high = Math.max(high, z);
	};
	outline.forEach(sample);
	for (const { quad } of space.cells) {
		const a = quad[0];
		for (let k = 1; k < quad.length - 1; k += 1) {
			const [b, c] = [quad[k], quad[k + 1]];
			const longest = Math.max(distance(a, b), distance(b, c), distance(c, a));
			const n = Math.max(1, Math.ceil(longest / groundSampleSpacingM));
			for (let u = 0; u <= n; u += 1)
				for (let v = 0; v <= n - u; v += 1)
					sample([
						a[0] + (u * (b[0] - a[0]) + v * (c[0] - a[0])) / n,
						a[1] + (u * (b[1] - a[1]) + v * (c[1] - a[1])) / n
					]);
		}
	}
	return { low, high };
}
