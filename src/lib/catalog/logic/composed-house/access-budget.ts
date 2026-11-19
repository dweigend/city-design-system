import { planPoints } from './part-plan';
import { bounds } from '../ansicht/geometrie';
import type { HousePart } from './house-object';

/** Sum of member bounding volumes, including landings, rails and the terrain approach. */
export function accessShare(parts: HousePart[]) {
	let total = 0,
		access = 0;
	for (const p of parts) {
		const b = bounds(p);
		if ((p.kind === 'box' || p.kind === 'wedge') && p.rotation) {
			const points = planPoints(p);
			for (const k of [0, 1] as const) {
				b.min[k] = Math.min(...points.map((q) => q[k]));
				b.max[k] = Math.max(...points.map((q) => q[k]));
			}
		}
		const volume = b.max.reduce((v, end, i) => v * (end - b.min[i]), 1);
		total += volume;
		if (p.id.includes('/stair/')) access += volume;
	}
	return access / total;
}
