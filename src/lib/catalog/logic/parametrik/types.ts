import type { MaterialId } from '../../data/material';

/** Coordinates in meters: x/y ground plane, z height. */
export type Vec3 = [number, number, number];
export type Role = 'bestand' | 'neu';
/**
 * Material (data/material.ts). concrete, wood, metal draw without the material system as before;
 * all others only through the material system (SceneStyle.materials or their own id).
 */
export type { MaterialId } from '../../data/material';
export type ColorToken =
	| '--cat-hazard'
	| '--paper'
	| '--cat-living'
	| '--cat-health'
	| '--cat-mobility'
	| '--cat-business'
	| '--cat-nature'
	| '--blueprint'
	/** Memphis accent (ink or signal, never a flow color as accent; data/color.ts). */
	| '--signal';
type Base = {
	id: string;
	role: Role;
	token: ColorToken;
	material: MaterialId;
	detail?: boolean;
	rank?: number;
	stretchRank?: number;
	pattern?: string;
	shade?: number;
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
	section?: Role;
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
		| { kind: 'pipe'; points: Vec3[]; radius: number }
		/** Extruded ground polygon (x/y in meters) from z to z + height; for irregular cells and parcels. */
		| { kind: 'prism'; polygon: [number, number][]; z: number; height: number }
		/** Line only, no surface: grid edges, networks, plan lines. */
		| { kind: 'polyline'; points: Vec3[]; closed?: boolean }
		/** position = center. squash scales height (kissen, ufo). */
		| { kind: 'sphere'; position: Vec3; radius: number; squash?: number }
		/** Half sphere on its base center. facets > 0 = geodesic (icosahedron detail), edges drawn. */
		| { kind: 'dome'; position: Vec3; radius: number; height?: number; facets?: number }
		/** Rounded tube between two points (tube capsule). */
		| { kind: 'capsule'; from: Vec3; to: Vec3; radius: number }
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
/**
 * Moves any primitive vertically by `dz` meters; used by explosion (rank × gap) and stacking.
 * Returns a shallow copy; moved coordinates are new arrays, untouched ones (prism polygon) are
 * shared. The input is never mutated. `dz = 0` returns the input itself (same reference).
 */
export function shiftZ(p: Primitive, dz: number): Primitive {
	if (!dz) return p;
	const up = ([x, y, z]: Vec3): Vec3 => [x, y, z + dz];
	switch (p.kind) {
		case 'frame':
			return {
				...p,
				position: up(p.position),
				...(p.members ? { members: p.members.map(([a, b]): [Vec3, Vec3] => [up(a), up(b)]) } : {})
			};
		case 'pipe':
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
