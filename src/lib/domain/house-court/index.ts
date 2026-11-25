/** Module: Builds a house and its court from occupied storeys of a cell space. */

/** What a fine cell is to the house, as a data table of roles. */
export {
	/** House cell roles that record whether the role carries closed volume. */
	cellRoles,
	/** Role of one fine cell. */
	type CellRole
} from './roles';

/** Inputs, per-cell occupancy and the occupancy rule of a house around a court. */
export type {
	/** Cell occupancy with an inclusive first and exclusive last built storey. */
	HouseCell,
	/** Shared block inputs in meters and the unitless complexity, plus a uint32 seed. */
	HouseInputs,
	/** Frontage rise and lowest ground elevation in meters, plus block corner status. */
	HouseSite,
	/** One occupied storey with an explicit use and construction phase. */
	HouseStorey,
	/** Construction phases and uses assigned to an occupied piece of the datum stack. */
	StoreyProgram
} from './occupancy';
/** Local addresses and world-scoped references for house parts. */
export type {
	/** A part's identity and the addressed storeys it serves. */
	HousePartAddress,
	/** Part and storey addresses resolved in one supplied world. */
	HousePartRef
} from './part-refs';

/** Scale of a cell space, shared court access and the style row as one house applies it. */
export {
	/** True when a cell side opens onto a shared court beyond the parcel. */
	hasCourtAccess,
	/** Classifies a cell space by parcel area using the calm and large limits. */
	houseScale,
	/** The style row as one house of this scale applies it. */
	readHouseStyle,
	/** Area class of a cell space used by the house rule. */
	type HouseScale
} from './scale';

/** Slots per drawing detail, the house object builder and its figures. */
export {
	/** Plans a house around a court. */
	createHouseCourt,
	/** Assembles geometry and matching addresses in one pass for a storey-aware projection. */
	createHouseAssembly,
	/** Builds one placeable house from its style and cell space in local meters. */
	createHouseObject,
	/** Mints world-scoped refs for full-detail parts, with one stable body address per occupied slice. */
	readHousePartRefs,
	/** Immutable occupancy with an ID and the local part addresses of its full-detail object. */
	type HouseCourt,
	/** The cell whose ground the entrance steps take, when the site's entrance rise needs steps. */
	entranceStepCellId,
	/** Returns exposed planar walls and roofs in local meters for surface cladding. */
	houseFaces,
	/** Built and void cell counts, gross floor area and court area in m², and the tallest storey count. */
	houseFigures,
	/** The ordered role slots a style declares at a detail. */
	houseSlots,
	/** Full style geometry or closed solids in the single mass slot. */
	type HouseDetail
} from './object';

/** What makes a house salient in a picture: storeys, a corner, a large house. */
export {
	/** Reads the salience features of a house from its cell space and occupancy. */
	readHouseFeatures,
	/** Peak storey count, block corner status, and merged-unit size used for visual orientation (MAT-15). */
	type HouseFeatures
} from './features';

/** A planar house face that a surface family can clad. */
export type { HouseFace } from './faces';
/** A wall on an adjoining parcel, directed counterclockwise, with its occupied elevation range in world meters. */
export type { AdjoiningWall } from './wall-contact';
/** Identifies the exposed portions of parcel-boundary storeys after adjoining occupancy. */
export { readPartyWallExposure } from './party-exposure';

/** Style rows: occupancy tendencies, fills, roofs, openings, part kinds and slots per style. */
export {
	/** Named parameter sets for the house rule, including the neutral envelope preset. */
	houseStyles,
	/** Geometry used to fill a run of built cells. */
	type FillKind,
	/** Occupancy, fill, roofs, openings, part kinds, and slot assignments for the house rule (FORM-10). */
	type HouseStyle,
	/** Style names in menu order. */
	type HouseStyleName,
	/** Figure of an opening in a wall. */
	type OpeningKind,
	/** Solid set on top of a run, inside the storey above it in the same cell. */
	type RoofKind
} from './styles';
