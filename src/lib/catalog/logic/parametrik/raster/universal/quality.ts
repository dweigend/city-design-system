import type { Point2 } from '../../vocab';
import { area, cross } from '../geometry';

/**
 * Shape quality of a polygon set: smallest interior angle (degrees; reflex or degenerate corners
 * count as 0), smallest signed area (square meters; 0 for an empty set) and largest ratio of
 * longest to shortest edge (at least 1).
 */
export function quality(polygons: Point2[][]) {
	let minAngle = 180,
		minArea = Infinity,
		maxAspect = 1;
	for (const p of polygons) {
		minArea = Math.min(minArea, area(p));
		const lengths = p.map((a, i) =>
			Math.hypot(a[0] - p[(i + 1) % p.length][0], a[1] - p[(i + 1) % p.length][1])
		);
		maxAspect = Math.max(maxAspect, Math.max(...lengths) / Math.min(...lengths));
		for (let i = 0; i < p.length; i++) {
			const a = p[(i + p.length - 1) % p.length],
				b = p[i],
				c = p[(i + 1) % p.length];
			const cosine =
				((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) /
				(lengths[(i + p.length - 1) % p.length] * lengths[i]);
			const angle = (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
			minAngle = Math.min(minAngle, cross(a, b, c) > 1e-10 ? angle : 0);
		}
	}
	return { minAngle, minArea: polygons.length ? minArea : 0, maxAspect };
}
