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
			sampleTriangle(a, b, c, n, sample);
		}
	}
	return { low, high };
}

function sampleTriangle(a: Vec2, b: Vec2, c: Vec2, n: number, sample: (point: Vec2) => void) {
	const [ax, ay] = a;
	const bx = b[0] - ax;
	const by = b[1] - ay;
	const cx = c[0] - ax;
	const cy = c[1] - ay;
	for (let u = 0; u <= n; u++) {
		const ux = u * bx;
		const uy = u * by;
		for (let v = 0; v <= n - u; v++) sample([ax + (ux + v * cx) / n, ay + (uy + v * cy) / n]);
	}
}
