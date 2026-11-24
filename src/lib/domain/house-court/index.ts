/** What a fine cell is to the house, as a data table of roles. */
export { cellRoles, type CellRole } from './roles';

/** Inputs, per-cell occupancy and the occupancy rule of a house around a court. */
export {
	createHouseCourt,
	type HouseCell,
	type HouseCourt,
	type HouseInputs,
	type HouseSite
} from './occupancy';

/** Scale of a cell space, shared court access and the style row as one house applies it. */
export { hasCourtAccess, houseScale, houseStyleFor, type HouseScale } from './scale';

/** Slots per drawing detail, the house object builder and its figures. */
export {
	createHouseObject,
	entranceStepCellId,
	houseFaces,
	houseFigures,
	houseSlots,
	type HouseDetail
} from './object';

/** A planar house face that a surface family can clad. */
export type { HouseFace } from './faces';

/** Style rows: occupancy tendencies, fills, roofs, openings, part kinds and slots per style. */
export {
	houseStyles,
	type FillKind,
	type HouseStyle,
	type HouseStyleName,
	type OpeningKind,
	type RoofKind
} from './styles';
