import { drum } from '../parts';
import { serviceBend } from '../service-bend';
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
				panel(points[0][0], points[0][1], 0, 0.56, 0.56, 0.2, 'foot'),
				serviceBend(points, r, 'body'),
				drum([points[0][0], points[0][1], 0.2], r + 0.05, 0.2, 'brass'),
				...(type === 'riser' ? [] : [drum([end[0], end[1], 0], 0.15, end[2], 'foot')])
			];
		}
	);
}
export const manifolds = (
	['return', 'dogleg', 'riser', 'loop', 'bypass', 'offset', 'swan'] as const
).flatMap(service);
