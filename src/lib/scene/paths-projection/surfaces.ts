import { defaults } from '../../../config/paths-projection';
import type { PlaceableObject } from '../../core/object';
import { resolveSurfaces, type Drawable, type Surface, type SurfaceAssignment } from '../surface';

const pink = '--path';
const deepPink = '--cat-business-5';
const brass = '--cat-mobility';
const darkBrass = '--cat-mobility-5';

// Exact arithmetic: unity opacity keeps the stroke color opaque.
function stroke(color: Surface['color'], width: number, hidden?: number): Surface {
	return Object.freeze({
		color,
		finish: 'matte',
		stroke: Object.freeze({
			color,
			width,
			opacity: /* Exact arithmetic: line stroke is opaque. */ 1,
			hidden
		})
	});
}

const accessDeck = stroke(pink, defaults.deckStrokePx);

export const accessSurfaces = Object.freeze({
	deck: accessDeck,
	stairs: accessDeck,
	bearing: Object.freeze({ color: pink, finish: 'matte' })
} satisfies SurfaceAssignment);

export const railSurfaces = Object.freeze({
	bearing: Object.freeze({ color: darkBrass, finish: 'matte' }),
	platform: Object.freeze({ color: brass, finish: 'matte' })
} satisfies SurfaceAssignment);

export const pathSurfaces = {
	lane: stroke(pink, defaults.groundStrokePx),
	// The route remains legible under an overlapping upper deck in plan.
	route: stroke(deepPink, defaults.routeStrokePx, defaults.routeHiddenStrokeShare),
	rail: stroke(brass, defaults.railStrokePx),
	track: stroke(darkBrass, defaults.trackStrokePx)
} as const satisfies Record<string, Surface>;

const assetSurfaces = new Map<string, SurfaceAssignment>([
	['access', accessSurfaces],
	['rail', railSurfaces]
]);

/** Resolves a registered access or rail object's roles with the Paths palette. Other kinds
 * return undefined. Throws RangeError if a declared slot lacks a surface. */
export function projectPathAsset(object: PlaceableObject, kind: string): Drawable[] | undefined {
	const surfaces = assetSurfaces.get(kind);
	if (!surfaces) return undefined;
	const assignment = Object.fromEntries(
		object.slots.map((slot) => [slot, Object.hasOwn(surfaces, slot) ? surfaces[slot] : undefined])
	);
	return resolveSurfaces(object, assignment);
}
