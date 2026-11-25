/** Module: Places houses on addressed city parcels. */

export {
	createParcelHouse,
	createParcelHouseObject,
	type ParcelHouseRecipe,
	type ParcelHouseResult,
	type ParcelHouseSite,
	type PlacedParcelHouse
} from './parcel';
export { createTownBlockHouses, readParcelHouseWalls } from './block-houses';
export { createTownParcelSites } from './town-sites';
export { createTownHouseStudy, type TownHouseBlock } from './parcel-town';
export { townHouseRecipe } from './town-program';
