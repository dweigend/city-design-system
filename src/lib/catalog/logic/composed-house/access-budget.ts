import { windingRoute } from './circulation';
import { planPoints } from './part-plan';
import { bounds } from '../ansicht/geometrie';
import type { HousePart } from './house-object';
import type { Section } from './types';

/** Sum of member bounding volumes, including landings, rails and the terrain approach. */
export function accessShare(parts: HousePart[]) {
	let total = 0,
		access = 0;
	for (const p of parts) {
		const b = bounds(p),
			volume = b.max.reduce((v, end, i) => v * (end - b.min[i]), 1);
		total += volume;
		if (p.id.includes('/stair/')) access += volume;
	}
	return access / total;
}

/** Tests the actual winding stock against the volume budget and painted plot. */
export function accessFits(s: Section, parts: HousePart[]) {
	if (accessShare(parts) > 0.1) return false;
	const route = windingRoute(s);
	if (
		route.legs.reduce((sum, l) => sum + Math.hypot(l.to[0] - l.from[0], l.to[1] - l.from[1]), 0) >
		2.2 * (s.top - s.base[2])
	)
		return false;
	if (route.legs.some((l) => l.kind === 'stairs' && Math.abs(l.from[2] - l.to[2] - 0.17) > 0.02))
		return false;
	const inside = (x: number, y: number) =>
		s.cells.some((c) =>
			c.corners.every(([a, b], i) => {
				const [u, v] = c.corners[(i + 1) % 4];
				return (u - a) * (y - b) - (v - b) * (x - a) >= -1e-7;
			})
		);
	const occupied = parts
		.filter((p) => p.id.includes('/body/') || p.id.includes('/post/'))
		.map(bounds);
	return parts
		.filter((p) => p.id.includes('/stair/'))
		.every((p) => {
			if (!planPoints(p).every(([x, y]) => inside(x, y))) return false;
			const box = bounds(p);
			return occupied.every((b) =>
				b.min.some((lo, i) => lo >= box.max[i] - 0.02 || b.max[i] <= box.min[i] + 0.02)
			);
		});
}
