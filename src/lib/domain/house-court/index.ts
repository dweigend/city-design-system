/** Module: Builds a house and its court from occupied storeys of a cell space. */

/** What a fine cell is to the house, as a data table of roles. */
export { cellRoles, type CellRole } from './roles';

/** Inputs, per-cell occupancy and the occupancy rule of a house around a court. */
export type { HouseCell, HouseInputs, HouseSite } from './occupancy';
export type { HousePartAddress, HousePartRef } from './part-refs';

/** Scale of a cell space, shared court access and the style row as one house applies it. */
export { hasCourtAccess, houseScale, houseStyleFor, type HouseScale } from './scale';

/** Slots per drawing detail, the house object builder and its figures. */
export {
	createHouseCourt,
	createHouseObject,
	readHousePartRefs,
	type HouseCourt,
	entranceStepCellId,
	houseFaces,
	houseFigures,
	houseSlots,
	type HouseDetail
} from './object';

/** What makes a house salient in a picture: storeys, a corner, a large house. */
export { readHouseFeatures, type HouseFeatures } from './features';

/** A planar house face that a surface family can clad. */
export type { HouseFace } from './faces';
export type { AdjoiningWall } from './wall-contact';
export { readPartyWallExposure } from './party-exposure';

/** Style rows: occupancy tendencies, fills, roofs, openings, part kinds and slots per style. */
export {
	houseStyles,
	type FillKind,
	type HouseStyle,
	type HouseStyleName,
	type OpeningKind,
	type RoofKind
} from './styles';
