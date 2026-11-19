import { resolveParams, type ParamOverrides } from '../../core/params';
import { flowToken } from '../../data/focus';
import type { Vec3, Primitive } from '../parametrik/types';
import { routeDecks } from './route';
import { deckParts, WALKWAY_PARAMS, WALKWAY_PROFILE } from './span';
export { routeDecks };
export {
	spanSurvey,
	deckCorners,
	spanEnd,
	deckParts,
	WALKWAY_WIDTH_M,
	WALKWAY_PARAMS
} from './span';

/** Projects an ordered roof route in world meters (z up). Each span has two rails,
 * level treads or a slab, and a central pier when above the support datum.
 * Consecutive anchors need enough horizontal run for both sides of a bend. Prefix IDs when composing routes.
 * Width uses the schema bounds in meters, with the explicit width taking precedence over overrides.
 * Invalid dimensions throw RangeError. Output is detached and inputs are read without mutation. */
export function walkwayParts(
	points: readonly Vec3[],
	{
		id = 'walkway',
		width,
		groundZ = 0,
		simplifyAtCity = false
	}: { id?: string; width?: number; groundZ?: number; simplifyAtCity?: boolean } = {},
	overrides?: ParamOverrides<typeof WALKWAY_PARAMS>
): Primitive[] {
	if (!Number.isFinite(groundZ) || points.some((p) => !p.every(Number.isFinite)))
		throw new RangeError('Invalid walkway dimensions');
	const profile =
		width === undefined && !overrides
			? WALKWAY_PROFILE
			: resolveParams(WALKWAY_PARAMS, overrides, { width });
	const deckWidth = profile.width;
	return routeDecks(points, deckWidth).flatMap((ring, i) => {
		const a = points[i],
			b = points[i + 1];
		const key = `${id}:${i}`;
		const parts = deckParts(ring, key, deckWidth, flowToken.people, profile, simplifyAtCity);
		const height = (a[2] + b[2]) / 2 - profile.thickness - groundZ;
		if (height > 0)
			parts.push({
				id: key + ':pier',
				role: 'neu',
				token: flowToken.people,
				material: 'concrete',
				kind: 'cylinder',
				position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, groundZ],
				radius: deckWidth * 0.12,
				height
			});
		return parts;
	});
}
