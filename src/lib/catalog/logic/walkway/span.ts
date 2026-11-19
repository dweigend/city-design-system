import { defineParams, numberParam, resolveParams } from '../../core/params';
import type { ColorToken, Primitive, Vec3 } from '../parametrik/types';

/** Deck width, thickness and maximum tread rise in meters for elevated walkways. */
export const WALKWAY_PARAMS = defineParams({
	width: numberParam('Deck width', 'm', 2.2, [0.5, 10, 0.1]),
	thickness: numberParam('Deck thickness', 'm', 0.25, [0.01, 3, 0.01]),
	treadRise: numberParam('Maximum tread rise', 'm', 0.2, [0.01, 1, 0.01])
});
export const WALKWAY_PROFILE = resolveParams(WALKWAY_PARAMS);
export const WALKWAY_WIDTH_M = WALKWAY_PROFILE.width;
type Point = [number, number];
type Ring = [Vec3, Vec3, Vec3, Vec3];

/** Visible endpoint of a growing span in plan meters; share is in [0, 1]. */
export function spanEnd(a: Point, b: Point, share: number): Point {
	return [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share];
}

/** Deck perimeter in world meters, from the start cross-section to the end.
 * Growth retains the supplied plan length for the normal and collapses zero-share spans. */
export function deckCorners(
	a: Vec3,
	b: Vec3,
	width: number,
	share = 1,
	length = Math.hypot(b[0] - a[0], b[1] - a[1])
): Ring {
	const dx = (b[0] - a[0]) / length,
		dy = (b[1] - a[1]) / length;
	const half = share > 0 ? width / 2 : 0;
	const end = spanEnd([a[0], a[1]], [b[0], b[1]], share);
	const side = (x: number, y: number, z: number, sign: number): Vec3 => [
		x - dy * half * sign,
		y + dx * half * sign,
		z
	];
	const z = share === 1 ? b[2] : a[2] + (b[2] - a[2]) * share;
	return [
		side(a[0], a[1], a[2], -1),
		side(a[0], a[1], a[2], 1),
		side(end[0], end[1], z, 1),
		side(end[0], end[1], z, -1)
	];
}

/** Surveys the walking surfaces and handrail endpoints on a mitered span, in world metres. */
export function spanSurvey(
	ring: Ring,
	id: string,
	width: number,
	profile: Pick<typeof WALKWAY_PROFILE, 'thickness' | 'treadRise'> = WALKWAY_PROFILE,
	simplifyAtCity = false
) {
	const [a, b, c, d] = ring;
	const rise = d[2] - a[2],
		steps = Math.ceil(Math.abs(rise) / profile.treadRise) + 1;
	if (steps > 4096) throw new RangeError('Walkway exceeds the tread budget');
	const edge = (p: Vec3, q: Vec3, j: number): Point =>
		spanEnd([p[0], p[1]], [q[0], q[1]], j / steps);
	const treads = Array.from({ length: steps }, (_, i) => {
		const polygon =
			steps === 1
				? ring.map(([x, y]): Point => [x, y])
				: [edge(a, d, i), edge(b, c, i), edge(b, c, i + 1), edge(a, d, i + 1)];
		const level = a[2] + (steps === 1 ? 0 : rise * (i / (steps - 1)));
		return {
			id: steps === 1 ? id : id + ':tread:' + i,
			polygon,
			z: level - profile.thickness,
			height: profile.thickness,
			...(simplifyAtCity && steps > 1 ? { cityForm: i === 0 ? ring : (false as const) } : {})
		};
	});
	const raised = ([x, y, z]: Vec3): Vec3 => [x, y, z + 1];
	const rail = (side: number, start: Vec3, end: Vec3) => ({
		id: id + ':' + side,
		points: [raised(start), raised(end)] as [Vec3, Vec3],
		...(simplifyAtCity ? { cityForm: false as const } : {})
	});
	return { treads, rails: [rail(-width / 2, a, d), rail(width / 2, b, c)] };
}

/** Draws a surveyed span in the walkway's drafting treatment. */
export function deckParts(
	ring: Ring,
	id: string,
	width: number,
	token: ColorToken,
	profile: Pick<typeof WALKWAY_PROFILE, 'thickness' | 'treadRise'> = WALKWAY_PROFILE,
	simplifyAtCity = false
): Primitive[] {
	const { treads, rails } = spanSurvey(ring, id, width, profile, simplifyAtCity);
	return [
		...treads.map((p): Primitive => ({
			...p,
			kind: 'prism',
			bearing: 'slab',
			role: 'neu',
			token,
			material: 'concrete'
		})),
		...rails.map((p): Primitive => ({
			...p,
			kind: 'polyline',
			role: 'neu',
			token,
			material: 'metal'
		}))
	];
}
