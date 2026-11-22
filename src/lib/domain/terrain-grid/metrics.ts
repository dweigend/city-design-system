import { distance, type Vec2 } from '../../core/geometry';
import type { Quad } from './carrier';

/** Plan quality and maximum sampled grade. Grade is rise divided by plan run. */
export const quality = Object.freeze({
	minimumAngle: Math.PI / 6,
	maximumEdgeRatio: 3.5,
	maximumGrade: 0.2,
	maximumSampleStep: 1
});

export function meetsQuality(points: Quad<Vec2>) {
	const lengths = points.map((point, index) => distance(point, points[(index + 1) % 4]));
	if (Math.max(...lengths) > quality.maximumEdgeRatio * Math.min(...lengths)) return false;
	return points.every(([x, y], index) => {
		const [ax, ay] = points[(index + 1) % 4];
		const [bx, by] = points[(index + 3) % 4];
		const cross = (ax - x) * (by - y) - (ay - y) * (bx - x);
		const dot = (ax - x) * (bx - x) + (ay - y) * (by - y);
		return Math.atan2(cross, dot) >= quality.minimumAngle;
	});
}
