/** Module: Builds a house and its court from occupied storeys of a cell space. */

/** Local addresses and world-scoped references for house parts. */
export type {
	/** A part's identity and the addressed storeys it serves. */
	HousePartAddress,
	/** Part and storey addresses resolved in one supplied world. */
	HousePartRef
} from './part-refs';

/** Area-based scale and the style row as one house applies it. */
export {
	/** Classifies a cell space by parcel area using the calm and large limits. */
	houseScale,
	/** The style row as one house of this scale applies it. */
	readHouseStyle
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
