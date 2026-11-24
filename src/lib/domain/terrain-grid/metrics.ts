import { defaults } from '../../../config/terrain-grid';
import { distance, type Vec2 } from '../../core/geometry';

/** Plan quality and maximum sampled grade. Grade is rise divided by plan run. An undistorted
 * triangle split already has an edge ratio of √3; 2.4 leaves room for the relaxed triangles,
 * so no interior cell is dropped and no hole opens in the plan. */
export const quality = Object.freeze({
	minimumAngle: defaults.minimumPlanAngleRad,
	maximumEdgeRatio: defaults.maximumPlanEdgeRatio,
	maximumGrade: defaults.maximumPlanGradeRatio,
	maximumSampleStep: defaults.maximumPlanSampleStepM
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
