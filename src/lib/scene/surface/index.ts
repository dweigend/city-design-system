import { required } from '../../core/invariant';
import type { PlaceableObject, Shape } from '../../core/object';

/** Surface finish, with line reserved for pencil outlines. */
export type Finish = 'matte' | 'gloss' | 'glass' | 'line' | 'terrain';

/** One CSS color token and finish for a slot. Flat fills retain the token color on all faces. */
export type Surface = Readonly<{
	color: `--${string}`;
	finish: Finish;
	flat?: boolean;
	opacity?: `--alpha-${string}`;
}>;

/** Explicit lookup of surfaces by slot name. */
export type SurfaceAssignment = Readonly<Record<string, Surface | undefined>>;

/** South-first terrain samples. Each texel stores height, XY gradients, and signed bank distance. */
export type TerrainField = Readonly<{
	columns: number;
	rows: number;
	width: number;
	depth: number;
	samples: Float32Array;
}>;

/** One part’s id, geometry and surface. Height scale recovers true contour elevations.
 * Explicit strokes are packed XYZ endpoint pairs, in the same local meters as the shape. */
export type Drawable = Surface &
	Readonly<{
		id: string;
		shape: Shape;
		heightScale?: number;
		terrainField?: TerrainField;
		boundaryStroke?: boolean;
		strokeSegments?: readonly number[];
		visible?: boolean;
	}>;

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
	earth: Object.freeze({ color: '--river-earth', finish: 'matte' }),
	water: Object.freeze({ color: '--river-water', finish: 'matte', flat: true }),
	'water-section': Object.freeze({ color: '--river-section', finish: 'matte', flat: true })
} satisfies SurfaceAssignment);

/** Blueprint hull for city planning, with see-through surfaces. */
export const planningVolume = Object.freeze({
	volume: Object.freeze({
		color: '--blueprint-3',
		finish: 'glass',
		flat: true,
		opacity: '--alpha-hull'
	})
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
		return { id, shape, ...required(surfaces.get(slot), `surface for slot "${slot}"`) };
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
