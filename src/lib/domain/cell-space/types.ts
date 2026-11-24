import type { Vec2 } from '../../core/geometry';
import type { CellSide } from './sides';

/** One corner of a parcel outline: a stable key and its plan position in meters. */
export type ParcelCorner = Readonly<{ id: string; position: Vec2 }>;

/** A plan polygon of three or more corners, counterclockwise, convex or with re-entrant corners.
 * `frontage` lists edge identities (`parcelEdgeId(from, to)` of consecutive corners) that face the
 * alley. `baseZ` is the ground elevation, `storeyCount` the vertical extent of the space and
 * `storeyHeightM` its storey height (default 3.5 m). */
export type Parcel = Readonly<{
	id: string;
	corners: readonly ParcelCorner[];
	frontage: readonly string[];
	baseZ: number;
	storeyCount: number;
	storeyHeightM?: number;
}>;

/** One fine plan cell: a counterclockwise quad in meters and, per side i (corner i to i + 1), what
 * lies across it. `corner` is the parcel corner key of the corner quad it was refined from, `ear`
 * the JSON corner keys of its ear triangle (null for a convex parcel), `parent` that quad's ID. */
export type FineCell = Readonly<{
	id: string;
	parent: string;
	corner: string;
	ear: string | null;
	quad: readonly Vec2[];
	sides: readonly CellSide[];
}>;

/** The space a building rule fills: fine plan cells stacked in storeys from `baseZ`. Any source
 * that delivers this shape (a free parcel, a city bay, a later parcel package) can feed a rule. */
export type CellSpace = Readonly<{
	id: string;
	baseZ: number;
	storeyHeightM: number;
	storeyCount: number;
	cells: readonly FineCell[];
}>;
