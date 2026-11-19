import { drum, bulb, rod } from '../parts';
import { panel } from '../objects/forms';
import { series } from './series';
import type { Vec3 } from '../../parametrik/types';

const manifold = series(
	'service-manifolds',
	'deck',
	[2.5, 3.75, 5],
	['low-loop', 'service-height', 'overhead']
);
type Route = 'return' | 'dogleg' | 'riser' | 'loop' | 'bypass' | 'offset' | 'swan';
function run(type: Route, x: number, h: number): Vec3[] {
	const a: Vec3 = [-x, -0.65, 0.3],
		b: Vec3 = [-x, -0.65, h];
	switch (type) {
		case 'return':
			return [a, b, [x, -0.65, h], [x, 0.65, h], [-x, 0.65, h], [-x, 0.65, 0.3]];
		case 'dogleg':
			return [a, b, [0, -0.65, h], [0, 0.65, h], [x, 0.65, h]];
		case 'riser':
			return [a, b, [x, -0.65, h], [x, -0.65, h + 0.62]];
		case 'loop':
			return [a, b, [0, -0.65, h], [0, -0.65, h + 0.75], [x, -0.65, h + 0.75], [x, -0.65, 0.3]];
		case 'bypass':
			return [a, b, [-x, 0.65, h], [x, 0.65, h], [x, -0.65, h], [x, -0.65, 0.3]];
		case 'offset':
			return [a, b, [0, 0, h], [x, 0, h], [x, 0.65, h]];
		case 'swan':
			return [a, b, [-x, 0, h + 0.65], [x, 0, h + 0.65], [x, 0.65, h]];
	}
}
function service(type: Route) {
	return manifold(
		type + '-service-manifold',
		['foot', 'body', 'brass'],
		() => 2.25,
		(w, v) => {
			const r = 0.17 + 0.03 * v,
				points = run(type, w / 2 - 0.32, 1.05 + 0.58 * v),
				end = points[points.length - 1];
			return [
				panel(0, 0, 0, w, 2.16, 0.3, 'foot'),
				...points.slice(1).map((p, i) => rod(points[i], p, r, 'body')),
				...points.slice(1, -1).map((p) => bulb(p, r * 1.14, 1, 'brass')),
				drum([points[0][0], points[0][1], 0.3], r + 0.07, 0.2, 'brass'),
				drum([end[0], end[1], 0.3], 0.15, Math.max(0.15, end[2] - 0.3), 'foot')
			];
		}
	);
}
export const manifolds = (
	['return', 'dogleg', 'riser', 'loop', 'bypass', 'offset', 'swan'] as const
).flatMap(service);
