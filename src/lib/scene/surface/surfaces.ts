import { required } from '../../core/invariant';
import type { PlaceableObject, Shape } from '../../core/object';

/** Surface finish, with line reserved for pencil outlines and shadow for flat ground shade that
 * darkens what lies below it without stacking. */
export type Finish = 'matte' | 'gloss' | 'glass' | 'line' | 'terrain' | 'shadow';

/** One CSS color token and finish for a slot. Flat fills retain the token color on all faces. */
export type Surface = Readonly<{
	color: `--${string}`;
	finish: Finish;
	flat?: boolean;
	/** Keeps the authored fill color when the display applies its paper veil. */
	preserveColor?: boolean;
	opacity?: `--alpha-${string}`;
	/** Fine even grain of a model material (MAT-8): an Oklab lightness swing of speckles of
	 * `cellM` meters, fixed in world space. */
	grain?: Readonly<{ amount: number; cellM: number }>;
	stroke?: Readonly<{
		color: `--${string}`;
		width: number;
		opacity: number;
		/** Share of the opacity kept where a body in front hides the stroke; 0 omits hidden lines. */
		hidden?: number;
		/** Share of the opacity the farthest stroke of the picture loses, so depth reads. */
		recede?: number;
	}>;
}>;

/** Horizontal offsets in local meters, x and y per fill vertex and per explicit stroke endpoint.
 * The stage moves the retained geometry by `amount` times the offsets without rebuilding it. */
export type Warp = Readonly<{
	fill: readonly number[];
	stroke?: readonly number[];
	amount: number;
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
 * Explicit strokes are packed XYZ endpoint pairs in local meters. Vertical scale transforms fill and stroke positions around the same pivot. */
export type Drawable = Surface &
	Readonly<{
		id: string;
		shape: Shape;
		heightScale?: number;
		terrainField?: TerrainField;
		boundaryStroke?: boolean;
		/** Fold angle in radians for mesh hairlines, including on landscape stages. */
		creaseAngleRad?: number;
		/** Exclusive mesh index ends of independent bodies for crease extraction. */
		creaseGroups?: readonly number[];
		strokeSegments?: readonly number[];
		visible?: boolean;
		fillVisible?: boolean;
		fillAlpha?: number;
		colorMix?: Readonly<{ token: `--${string}`; amount: number }>;
		vertical?: Readonly<{ scale: number; pivot: number }>;
		/** A translucent fill still hides what lies behind it from strokes, and only its front
		 * layer is tinted. */
		occlude?: boolean;
		/** Strength from 0 to 1 of pencil hatching on the faces turned from the sun. */
		hatch?: number;
		/** Oklab lightness offsets of the roof, the lit wall and the wall in shade; the stage's
		 * own values apply when absent. */
		faces?: Readonly<{ top: number; lit: number; shadow: number }>;
		warp?: Warp;
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

const districtEnvelope = {
	finish: 'matte',
	stroke: { color: '--district-edge', width: 0.9, opacity: 0.8 }
} as const;

/** Three saturated lightness steps of blueprint, light to deep, for the detached, block and
 * high-rise center districts, all well below the pale water in value and above it in chroma, with
 * a deep blueprint hairline. The shaded, opaque fill keeps the kinds apart in plan and in height.
 * Their ground shade darkens the paper without stacking. */
export const districtSurfaces = Object.freeze({
	detached: { ...districtEnvelope, color: '--district-detached' },
	block: { ...districtEnvelope, color: '--district-block' },
	center: { ...districtEnvelope, color: '--district-center' },
	shadow: { color: '--ground-shadow', finish: 'shadow', flat: true }
} as const satisfies SurfaceAssignment);

/** Fine pencil lines and small joints for the coarse carrier. */
export const planningStudy = Object.freeze({
	lattice: {
		color: '--ink-2',
		finish: 'matte',
		flat: true,
		stroke: { color: '--ink-2', width: 0.68, opacity: 0.53 }
	}
} as const satisfies SurfaceAssignment);

/** Plan overlays by slot: the dry plan grid in graphite, the edges of its water cells in the water
 * hue, selected crossings in path pink, and the lane, parcel and public ground overlays. */
export const planOverlaySurfaces = Object.freeze({
	plan: {
		color: '--ink-2',
		finish: 'matte',
		stroke: { color: '--ink-2', width: 0.8, opacity: 0.82 }
	},
	'water-cells': {
		color: '--river-section',
		finish: 'matte',
		stroke: { color: '--river-section', width: 0.8, opacity: 0.75 }
	},
	crossings: {
		color: '--path',
		finish: 'matte',
		stroke: { color: '--path', width: 3, opacity: 1 }
	},
	lanes: {
		color: '--path-plan',
		finish: 'matte',
		flat: true,
		stroke: { color: '--path', width: 1.2, opacity: 1 }
	},
	parcels: {
		color: '--ink-2',
		finish: 'matte',
		stroke: { color: '--ink-2', width: 0.7, opacity: 0.74 }
	},
	'merged-units': {
		color: '--public-ground',
		finish: 'matte',
		flat: true
	}
} as const satisfies SurfaceAssignment);

/** Neutral drawings of stock out of focus: a pale see-through veil and pencil paper, both with
 * graphite lines. Widths and opacities are set per display level by the projection. */
export const stockSurfaces = Object.freeze({
	veil: { color: '--stock-veil', finish: 'matte', stroke: '--stock-line' },
	pencil: { color: '--stock-pencil', finish: 'matte', stroke: '--stock-line' }
} as const);

/** Upper tick of the fixed column height scale in true meters. */
export const cityHeightScaleM = 140;

/** Sequential palette shared by all settlements, with extra contrast at town heights. */
export function heightRamp(height: number) {
	const share = Math.min(1, Math.max(0, height / cityHeightScaleM));
	const breakPoint = 0.15;
	const low = share <= breakPoint;
	return {
		color: low ? '--height-low' : '--height-mid',
		colorMix: {
			token: low ? '--height-mid' : '--height-high',
			amount: low ? share / breakPoint : (share - breakPoint) / (1 - breakPoint)
		},
		opacity: '--alpha-opaque',
		preserveColor: true,
		line: '--height-line'
	} as const;
}

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
