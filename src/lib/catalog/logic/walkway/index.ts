import { flowToken } from '../../data/focus';
import type { Vec3, Primitive } from '../parametrik/types';
import { deckCorners, deckParts, WALKWAY_WIDTH_M } from './span';
export { deckCorners, spanEnd, deckParts, WALKWAY_WIDTH_M } from './span';

/** Projects an ordered roof route in world meters (z up). Each span has two rails,
 * level treads or a slab, and a central pier when above the support datum.
 * Consecutive anchors need a horizontal run. Prefix IDs when composing routes. */
export function walkwayParts(
	points: readonly Vec3[],
	{ id = 'walkway', width = WALKWAY_WIDTH_M, groundZ = 0 } = {}
): Primitive[] {
	if (
		!Number.isFinite(width) ||
		width <= 0 ||
		!Number.isFinite(groundZ) ||
		points.some((p) => !p.every(Number.isFinite))
	)
		throw new RangeError('Invalid walkway dimensions');
	return points.slice(1).flatMap((b, i) => {
		const a = points[i],
			dx = b[0] - a[0],
			dy = b[1] - a[1],
			length = Math.hypot(dx, dy);
		if (!length) throw new RangeError('A walkway span needs a horizontal run');
		const key = `${id}:${i}`;
		const parts = deckParts(deckCorners(a, b, width, 1, length), key, width, flowToken.people);
		const height = (a[2] + b[2]) / 2 - 0.25 - groundZ;
		if (height > 0)
			parts.push({
				id: key + ':pier',
				role: 'neu',
				token: flowToken.people,
				material: 'concrete',
				kind: 'cylinder',
				position: [a[0] + dx / 2, a[1] + dy / 2, groundZ],
				radius: width * 0.12,
				height
			});
		return parts;
	});
}
