/** Module: Plans cell occupancy and edits addressed upper-storey volumes. */

export {
	/** Plans ordered cell runs and entrances with resolved tendencies and a seeded input. */
	createHouseOccupancy,
	/** Rise in meters above which the lane entrance takes steps. */
	entranceStepRiseM,
	/** Cell occupancy with an inclusive first and exclusive last built storey. */
	type HouseCell,
	/** Shared block inputs in meters and unitless complexity, plus a uint32 seed. */
	type HouseInputs,
	/** Frozen occupancy, resolved inputs and access facts, or a reason the plot stays garden. */
	type HouseOccupancy,
	/** Style ID, height tendencies, and the large building's court and roof requirements. */
	type HouseOccupancyParameters,
	/** Plain parameters for stepped heights, seeded jitter and open ground storeys. */
	type HouseOccupancyTendencies,
	/** Terrain, corner and scale inputs, with optional programs by datum and cell. */
	type HouseSite,
	/** One occupied storey with an explicit use and construction phase. */
	type HouseStorey,
	/** Construction phase and use assigned to an occupied piece of the datum stack. */
	type StoreyProgram
} from './occupancy';

export {
	/** House cell roles that record whether the role carries closed volume. */
	cellRoles,
	/** Role of one fine cell. */
	type CellRole
} from './roles';

export {
	/** True when a cell side opens onto a shared court beyond the parcel. */
	hasCourtAccess,
	/** Area class of a cell space used by the house rule. */
	type HouseScale
} from './scale';

/** Reads the first entrance path's cell and its frontage side index, if present. */
export { readEntranceSide } from './graph';

export {
	/** Opens a house occupancy for edits to occupied runs. */
	createMassing,
	/** Creates closed, datum-addressed prisms in the mass slot. */
	createMassingParts,
	/** Original ground plan and edited occupied runs in cell and storey order. */
	type Massing
} from './massing';

export {
	/** Clips upper runs inward from the selected setback edge. */
	createSetbackMassing,
	/** Edge, start storey, depth in cells, and storeys per step. */
	type SetbackOptions
} from './setback';

export {
	/** Carves a seeded share of upper slices and reports their datum addresses. */
	createPorousMassing,
	/** The original address and kind of a carved slice. */
	type MassingVoid,
	/** Target fraction of upper slices and optional seed. */
	type PorosityOptions
} from './porosity';
