import { defineParams, numberParam, resolveParams } from '../params';
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

/** Four ordered deck corners (start left/right, end right/left) at walking height. */
export function deckParts(
	ring: Ring,
	id: string,
	width: number,
	token: ColorToken,
	profile: Pick<typeof WALKWAY_PROFILE, 'thickness' | 'treadRise'> = WALKWAY_PROFILE
): Primitive[] {
	const [a, b, c, d] = ring;
	const base = { token, role: 'neu' } as const;
	const deck: Primitive = {
		id,
		kind: 'prism',
		polygon: ring.map(([x, y]) => [x, y]),
		z: a[2] - profile.thickness,
		height: profile.thickness,
		...base,
		material: 'concrete'
	};
	const raised = ([x, y, z]: Vec3): Vec3 => [x, y, z + 1];
	const rail = (side: number, start: Vec3, end: Vec3): Primitive => ({
		id: `${id}:${side}`,
		kind: 'polyline',
		points: [raised(start), raised(end)],
		...base,
		material: 'metal'
	});
	if (a[2] === d[2]) return [deck, rail(-width / 2, a, d), rail(width / 2, b, c)];
	const steps = Math.ceil(Math.abs(d[2] - a[2]) / profile.treadRise) + 1;
	if (steps > 4096) throw new RangeError('Walkway exceeds the tread budget');
	const treads = Array.from({ length: steps }, (_, i): Primitive => {
		const edge = (p: Vec3, q: Vec3, j: number): Point =>
			spanEnd([p[0], p[1]], [q[0], q[1]], j / steps);
		return {
			...deck,
			id: `${id}:tread:${i}`,
			polygon: [edge(a, d, i), edge(b, c, i), edge(b, c, i + 1), edge(a, d, i + 1)],
			z: a[2] + (d[2] - a[2]) * (i / (steps - 1)) - profile.thickness
		};
	});
	return [...treads, rail(-width / 2, a, d), rail(width / 2, b, c)];
}
