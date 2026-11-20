import { spanSurvey } from '../walkway';
import type { Primitive, Vec3 } from '../parametrik/types';

/** Recovers the full flight widths and endpoints from paired handrails, including the
 * portion of a terminal tread shared with its landing at the same elevation. */
export function surveyedFloors(parts: Primitive[]) {
	const byId = new Map(parts.map((p) => [p.id, p]));
	return parts.flatMap((p) => {
		if (p.kind !== 'pipe' || !p.id.startsWith('town-walk/') || !p.id.endsWith('/right')) return [];
		const id = p.id.slice(0, -6),
			left = byId.get(id + '/left');
		if (left?.kind !== 'pipe') throw Error('Missing handrail ' + id);
		const sole = ([x, y, z]: Vec3): Vec3 => [x, y, z - 1.04];
		const [a, d] = p.points.map(sole),
			[b, c] = left.points.map(sole);
		return spanSurvey([a, b, c, d], id, Math.hypot(b[0] - a[0], b[1] - a[1]), {
			thickness: 0.2,
			treadRise: 0.17
		}).treads.map((t) => ({
			...t,
			kind: 'prism' as const,
			token: '--paper' as const,
			role: 'neu' as const,
			material: 'concrete' as const
		}));
	});
}
/** Identifies projected upper walking faces independently of the palette. */
export function walkingPlates(parts: Primitive[]) {
	return parts.filter(
		(p): p is Extract<Primitive, { kind: 'prism' }> =>
			p.kind === 'prism' &&
			(p.id.startsWith('court/') ||
				(p.id.startsWith('town-walk/') && !/\/(life|planter|meeting)\//.test(p.id)))
	);
}
