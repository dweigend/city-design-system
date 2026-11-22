import { distance, type Vec2 } from '../../core/geometry';

/** Plan quality and maximum sampled grade. Grade is rise divided by plan run. */
export const quality = Object.freeze({
	minimumAngle: Math.PI / 6,
	maximumEdgeRatio: 2.1,
	maximumGrade: 0.2,
	maximumSampleStep: 1
});

export function meetsQuality(points: readonly Vec2[]) {
	const lengths = points.map((point, index) =>
		distance(point, points[(index + 1) % points.length])
	);
	if (Math.max(...lengths) > quality.maximumEdgeRatio * Math.min(...lengths)) return false;
	return points.every(([x, y], index) => {
		const [ax, ay] = points[(index + 1) % points.length];
		const [bx, by] = points[(index + points.length - 1) % points.length];
		const cross = (ax - x) * (by - y) - (ay - y) * (bx - x);
		const dot = (ax - x) * (bx - x) + (ay - y) * (by - y);
		return Math.atan2(cross, dot) >= quality.minimumAngle;
	});
}
