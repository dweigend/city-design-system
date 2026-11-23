/** What a fine cell is to the house, as a data table of roles. */
export { cellRoles, type CellRole } from './roles';

/** Inputs, per-cell occupancy and the occupancy rule of a house around a court. */
export { createHouseCourt, type HouseCell, type HouseCourt, type HouseInputs } from './occupancy';

/** Slots per drawing detail, the house object builder and its figures. */
export { createHouseObject, houseDetails, houseFigures, type HouseDetail } from './object';
