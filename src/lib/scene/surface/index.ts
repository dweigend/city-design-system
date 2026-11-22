import { required } from '../../core/invariant';
import type { PlaceableObject, Shape } from '../../core/object';

/** Surface finish, with line reserved for pencil outlines. */
export type Finish = 'matte' | 'gloss' | 'glass' | 'line';

/** One CSS color token and finish for a slot. */
export type Surface = Readonly<{ color: `--${string}`; finish: Finish }>;

/** Explicit lookup of surfaces by slot name. */
export type SurfaceAssignment = Readonly<Record<string, Surface | undefined>>;

/** One part's id, geometry and assigned surface. Geometry stays in meters. */
export type Drawable = Surface & Readonly<{ id: string; shape: Shape }>;

/** Frozen palette entries for common slots. Select the entries declared by the object. */
export const defaultAssignment = Object.freeze({
	wall: Object.freeze({ color: '--cat-living', finish: 'matte' }),
	roof: Object.freeze({ color: '--body-living', finish: 'matte' }),
	frame: Object.freeze({ color: '--ink', finish: 'line' }),
	deck: Object.freeze({ color: '--ground-stone', finish: 'matte' }),
	glass: Object.freeze({ color: '--blueprint', finish: 'glass' }),
	ground: Object.freeze({ color: '--terrain-soil', finish: 'matte' }),
	foliage: Object.freeze({ color: '--cat-foliage', finish: 'matte' })
} satisfies SurfaceAssignment);

/** Resolves a fresh list in part order, retaining frozen shape references and leaving inputs
 * untouched. Throws RangeError naming a missing or extra slot. No palette is applied implicitly.
 */
export function resolveSurfaces(
	object: PlaceableObject,
	assignment: SurfaceAssignment
): Drawable[] {
	const declared = new Set(object.slots);
	for (const slot of Object.getOwnPropertyNames(assignment)) {
		if (!declared.has(slot)) throw new RangeError(`Unknown surface slot "${slot}"`);
	}
	const surfaces = new Map<string, Surface>();
	for (const slot of declared) {
		const surface = Object.hasOwn(assignment, slot) ? assignment[slot] : undefined;
		if (!surface) throw new RangeError(`Missing surface for slot "${slot}"`);
		surfaces.set(slot, surface);
	}
	return object.parts.map(({ id, slot, shape }) => {
		const { color, finish } = required(surfaces.get(slot), `surface for slot "${slot}"`);
		return { id, shape, color, finish };
	});
}

/** Checks assigned colors against the supplied token names without modifying either input.
 * Throws RangeError naming the first unknown token.
 */
export function validateTokens(assignment: SurfaceAssignment, tokenNames: readonly string[]): void {
	const known = new Set(tokenNames);
	for (const slot of Object.getOwnPropertyNames(assignment)) {
		const surface = assignment[slot];
		if (surface && !known.has(surface.color))
			throw new RangeError(`Unknown color token "${surface.color}" for slot "${slot}"`);
	}
}
