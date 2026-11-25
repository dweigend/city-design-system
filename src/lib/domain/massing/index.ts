/** Module: Plans cell occupancy and programs its occupied storeys. */

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
