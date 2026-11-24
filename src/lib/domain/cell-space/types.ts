import type { Vec2 } from '../../core/geometry';
import type { Ref } from '../../core/ref';
import type { CellSide } from './sides';

/** One corner of a parcel outline: a stable key and its plan position in meters. */
export type ParcelCorner = Readonly<{ id: string; position: Vec2 }>;

/** A plan polygon of three or more corners, counterclockwise, convex or with re-entrant corners.
 * `frontage` lists edge identities (`parcelEdgeId(from, to)` of consecutive corners) that face the
 * alley, `courtEdges` (optional) edges that open onto a shared court beyond the parcel, such as
 * the public court of a perimeter block. `baseZ` is the ground elevation, `storeyCount` the vertical extent of the space and
 * the sizing gives either a uniform height or individual storey heights. */
export type Parcel = StoreySizing &
	Readonly<{
		id: string;
		corners: readonly ParcelCorner[];
		frontage: readonly string[];
		courtEdges?: readonly string[];
	}>;

/** One fine plan cell: a convex counterclockwise polygon in meters and, per side i (corner i to i + 1), what
 * lies across it. `corner` is the parcel corner key of the corner quad it was refined from, `ear`
 * the JSON corner keys of its ear triangle (null for a convex parcel), `parent` that quad's ID.
 * `cornerIds` holds the shared topological point keys in polygon order. */
export type FineCell = Readonly<{
	id: string;
	parent: string;
	corner: string;
	ear: string | null;
	quad: readonly Vec2[];
	cornerIds: readonly string[];
	sides: readonly CellSide[];
}>;

/** The space a building rule fills: fine plan cells stacked in storeys from `baseZ`. Any source
 * that delivers this shape (a free parcel or an addressed city parcel) can feed a rule. */
export type CellSpace = StoreyStack &
	Readonly<{
		id: string;
		kind?: 'strip';
		cells: readonly FineCell[];
		storeys: readonly CellStorey[];
	}>;

/** Recipe input for the vertical extent of a parcel or an existing subdivision. */
export type StoreySizing = Readonly<{
	baseZ: number;
	storeyCount: number;
	storeyHeightM?: number;
	storeyHeightsM?: readonly number[];
}>;

/** Individual storey heights and boundary elevations, with shorthand for uniform stacks. */
export type StoreyStack = Readonly<{
	baseZ: number;
	storeyCount: number;
	storeyHeightM: number | undefined;
	storeyHeightsM: readonly number[];
	storeyElevationsM: readonly number[];
}>;

/** One addressed vertical slice of a fine cell. */
export type CellStorey = Readonly<{
	ref: Ref<'storey'>;
	cellId: string;
	storey: number;
	bottomZ: number;
	topZ: number;
	heightM: number;
}>;
