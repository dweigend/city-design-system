import type { MaterialId } from '../../data/material';

/** Coordinates in meters: x/y ground plane, z height. */
export type Vec3 = [number, number, number];
type BuildingRole = 'bestand' | 'neu';
export type Role = BuildingRole | 'traeger';
/**
 * Material (data/material.ts). concrete, wood, metal draw without the material system as before;
 * all others only through the material system (SceneStyle.materials or their own id).
 */
export type { MaterialId } from '../../data/material';
export const surfaceTokens = [
	'--cat-health-3',
	'--cat-health-5',
	'--cat-business-3',
	'--cat-business-2',
	'--cat-nature-2',
	'--cat-foliage',
	'--cat-hazard',
	'--paper',
	'--ink',
	'--ink-3',
	'--cat-living',
	'--cat-health',
	'--cat-mobility',
	'--cat-business',
	'--cat-nature',
	'--blueprint',
	'--body-living',
	'--signal'
] as const;
export type ColorToken = (typeof surfaceTokens)[number];
/** A surface selected independently of a generated solid or sheet. */
export type FinishId =
	| 'city-drawing'
	| MaterialId
	| import('../../data/materialAusfuehrung').AusfuehrungId
	| import('../../data/materialPrint').PrintFinish;
type Base = {
	/** Explicit surface applied after generation. Omission keeps the original drafting treatment. */
	finish?: FinishId;
	id: string;
	role: Role;
	/** Previous drawing treatment for an existing bible plate. A carrier otherwise uses stock there. */
	legacyRole?: BuildingRole;
	/** Secondary members use the detail stroke. Alternate braces remain on the bible plates. */
	sectionDiameter?: number;
	planned?: boolean;
	member?: 'primary' | 'secondary' | 'alternate';
	/** New envelope in the sandbox when the bible plate uses cutaway hatching or glazing. */
	envelope?: boolean;
	/** Bearing locations in world meters, rendered as ink dots in the drafting treatment. */
	bearings?: Vec3[];
	token: ColorToken;
	/** Second pigment of an opaque print patch. The first pigment is the part token. */
	overprint?: ColorToken;
	material: MaterialId;
	detail?: boolean;
	/** Sandbox block drawing: omit this detail, or replace its stair span with a continuous sheet. */
	cityForm?: false | [Vec3, Vec3, Vec3, Vec3];
	/** Owning house cell for a selectable roof surface or pencil ridge. */
	roofCell?: string;
	rank?: number;
	stretchRank?: number;
	pattern?: string;
	shade?: number;
	/** Share of paper mixed into the sandbox construction phase's surface pigment. */
	ageTint?: number;
	floors?: number[];
	/** Rotation about the vertical axis in radians (counter-clockwise in plan), pivot = primitive center. */
	rotation?: number;
	/** Transparent skin (climate skin, glass): surface at low opacity, edges stay. */
	glass?: boolean;
	/** false: surface only, no crease lines (Eckmodule draw their own contour as polylines). */
	edges?: boolean;
	/** View layer: strong edge; network in focus in ink, selection in signal (data/color.ts). */
	emphasis?: 'netz' | 'auswahl';
	/** View layer: cut face (poché) – new in ink, existing stock hatched gray. */
	section?: BuildingRole;
};
/** Indexed CCW triangles and explicit pencil paths sharing world-space metre coordinates. */
export type MeshForm = {
	kind: 'mesh';
	rotation?: never;
	points: Vec3[];
	triangles: number[];
	lines: number[][];
};
export type Primitive = Base &
	(
		| { kind: 'box'; position: Vec3; size: Vec3 }
		| { kind: 'cylinder' | 'cone'; position: Vec3; radius: number; height: number }
		/**
		 * Ring standing upright, axis along local x (rotation turns it in plan); position = center.
		 * innerRadius 0 = solid disc (pane). tilt: axis raised above the horizon in radians.
		 * curvature: radius of the carrying sphere; the ring then follows its curve as a shell
		 * from −depth/2 to +depth/2 around the sphere surface, and position is the touch point.
		 */
		| {
				kind: 'ring';
				position: Vec3;
				radius: number;
				innerRadius: number;
				depth: number;
				tilt?: number;
				curvature?: number;
		  }
		| { kind: 'pipe'; points: Vec3[]; radius: number; sampled?: boolean }
		/**
		 * Extruded ground polygon (x/y in meters) from z to z + height; for irregular cells and parcels.
		 * holes: inner rings cut out of the polygon (courtyards); they do not touch the outer ring.
		 */
		| {
				kind: 'prism';
				/** Horizontal plate eligible for a collar at a through-post. */
				bearing?: 'slab';
				polygon: [number, number][];
				holes?: [number, number][][];
				z: number;
				height: number;
				topToken?: ColorToken;
		  }
		/** Line only, no surface: grid edges, networks, plan lines. */
		| MeshForm
		| { kind: 'polyline'; points: Vec3[]; closed?: boolean }
		/** position = center. squash scales height (kissen, ufo). */
		| { kind: 'sphere'; position: Vec3; radius: number; squash?: number; fine?: boolean }
		/** Half sphere on its base center. facets > 0 = geodesic (icosahedron detail), edges drawn. */
		| { kind: 'dome'; position: Vec3; radius: number; height?: number; facets?: number }
		/** Rounded tube between two points (tube capsule). */
		| {
				kind: 'capsule';
				from: Vec3;
				to: Vec3;
				radius: number;
				printBand?: { heightShare: number; upper: ColorToken };
		  }
		/** Box whose top falls along local x from full height to low × height. position = min corner. */
		| { kind: 'wedge'; position: Vec3; size: Vec3; low?: number }
		/**
		 * Arched section extruded along local y; position = base center.
		 * arch: wall slab with round opening (portal). vault: barrel (solid without thickness).
		 * halfpipe: concave shell.
		 */
		| {
				kind: 'arch' | 'vault' | 'halfpipe';
				position: Vec3;
				width: number;
				length: number;
				rise: number;
				thickness?: number;
		  }
		/** Space frame (Stabwerk): bars on a cells grid inside size; position = min corner. */
		| {
				kind: 'frame';
				/** Explicit world-coordinate member axes, meters; replaces the rectangular cells grid. */
				members?: [Vec3, Vec3][];
				position: Vec3;
				size: Vec3;
				cells: [number, number, number];
				bar: number;
				braced?: boolean;
		  }
		/** Torus; axis 'z' lies flat, 'x' stands upright along local x. arc < 2π gives a partial ring. */
		| {
				kind: 'torus';
				position: Vec3;
				radius: number;
				tube: number;
				axis?: 'z' | 'x';
				arc?: number;
		  }
		/** Helicoid band (Wendelrampe, Spirale) around position, from z to z + height. */
		| {
				kind: 'helix';
				position: Vec3;
				radius: number;
				innerRadius: number;
				height: number;
				turns: number;
				thickness: number;
		  }
		/** Tensile surface through four corners (hypar), sag pulls the center down. */
		| { kind: 'membrane'; corners: [Vec3, Vec3, Vec3, Vec3]; sag?: number }
	);
/**
 * Box primitive; `position` is the min corner, `size` the extent, both in meters. New object that
 * keeps the `position` and `size` arrays by reference (not copied); callers must not mutate them.
 */
export function box(
	id: string,
	position: Vec3,
	size: Vec3,
	token: ColorToken = '--cat-living',
	role: Role = 'neu',
	material: MaterialId = 'concrete'
): Primitive {
	return { id, kind: 'box', position, size, token, role, material };
}
/** Clamps `n` to [min, max]; NaN and ±Infinity fall back to `min`. Assumes min ≤ max. */
export const clamp = (n: number, min: number, max: number) =>
	Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
/** Clamped (see `clamp`) and rounded to the nearest integer (halves round up): slider → count. */
export const count = (n: number, min: number, max: number) => Math.round(clamp(n, min, max));

/** Moves world-space attachments with the same point transform as their parent geometry. */
export function transformAnchors(p: Primitive, point: (position: Vec3) => Vec3): Primitive {
	const positioned: Primitive = p.cityForm
		? {
				...p,
				cityForm: [
					point(p.cityForm[0]),
					point(p.cityForm[1]),
					point(p.cityForm[2]),
					point(p.cityForm[3])
				]
			}
		: p;
	const withBearings = positioned.bearings
		? { ...positioned, bearings: positioned.bearings.map(point) }
		: positioned;
	if (withBearings.kind !== 'frame' || !withBearings.members) return withBearings;
	return {
		...withBearings,
		members: withBearings.members.map(([a, b]): [Vec3, Vec3] => [point(a), point(b)])
	};
}

/** Moves any primitive vertically; used by explosion (rank × gap) and stacking. */
export function shiftZ(primitive: Primitive, dz: number): Primitive {
	if (!dz) return primitive;
	const up = ([x, y, z]: Vec3): Vec3 => [x, y, z + dz];
	const p = transformAnchors(primitive, up);
	switch (p.kind) {
		case 'pipe':
		case 'mesh':
		case 'polyline':
			return { ...p, points: p.points.map(up) };
		case 'prism':
			return { ...p, z: p.z + dz };
		case 'capsule':
			return { ...p, from: up(p.from), to: up(p.to) };
		case 'membrane':
			return { ...p, corners: p.corners.map(up) as [Vec3, Vec3, Vec3, Vec3] };
		default:
			return { ...p, position: up(p.position) };
	}
}
/**
 * Explosion: each primitive rises by max(0, rank) × gap meters (40-grammatik §3.4). New array
 * in input order; primitives without a lift keep their reference. Inputs are not mutated.
 */
export const explode = (primitives: Primitive[], gap: number) =>
	primitives.map((p) => shiftZ(p, gap * Math.max(0, p.rank ?? 0)));

/** Structural strokes and frame layers share the same primitive classification. */
export function isStructural(p: Primitive): boolean {
	return p.role === 'traeger' || Boolean(p.member);
}

/** Preserves the role used by renderers that predate the sandbox structural system. */
export function legacyRoleOf(primitive: Primitive): BuildingRole {
	return primitive.role === 'traeger' ? (primitive.legacyRole ?? 'bestand') : primitive.role;
}

/** Interpolates each world-metre coordinate at fraction t along the segment. */
export function interpolatePoint(a: Vec3, b: Vec3, t: number): Vec3 {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
