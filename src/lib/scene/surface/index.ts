import { required } from '../../core/invariant';
import type { PlaceableObject, Shape } from '../../core/object';

/** Surface finish, with line reserved for pencil outlines. */
export type Finish = 'matte' | 'gloss' | 'glass' | 'line' | 'terrain';

/** One CSS color token and finish for a slot. */
export type Surface = Readonly<{ color: `--${string}`; finish: Finish }>;

/** Explicit lookup of surfaces by slot name. */
export type SurfaceAssignment = Readonly<Record<string, Surface | undefined>>;

/** One part's id, geometry and assigned surface. Geometry stays in meters. */
export type Drawable = Surface & Readonly<{ id: string; shape: Shape }>;

type FlowColor = `--cat-${'living' | 'health' | 'mobility' | 'business' | 'nature'}`;

/** The house's neutral stock assignment, with one explicit finish per slot. */
export const existing = Object.freeze({
	plinth: Object.freeze({ color: '--ground-plinth', finish: 'matte' }),
	door: Object.freeze({ color: '--ink-3', finish: 'matte' }),
	wall: Object.freeze({ color: '--paper-2', finish: 'matte' }),
	roof: Object.freeze({ color: '--paper-3', finish: 'matte' }),
	glass: Object.freeze({ color: '--line', finish: 'glass' })
} satisfies SurfaceAssignment);

/** Paper ground and the pale step of the existing water color. */
export const landscape = Object.freeze({
	ground: Object.freeze({ color: '--paper-2', finish: 'terrain' }),
	water: Object.freeze({ color: '--cat-health-2', finish: 'matte' })
} satisfies SurfaceAssignment);

/** Returns the stock assignment with one flow color on the wall. */
export function accent(color: FlowColor): SurfaceAssignment {
	return Object.freeze({ ...existing, wall: Object.freeze({ ...existing.wall, color }) });
}

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
