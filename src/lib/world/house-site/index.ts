/** Module: Places houses on addressed city parcels. */

export {
	/** Reads closed fine cells contained in an addressed coarse bay and its model fill. */
	readFineCells,
	/** A datum-addressed storey prism and its outward face loops. */
	type BayFineCell
} from './fine-cells';

export {
	/** Places one seeded house in an addressed private parcel. */
	createParcelHouse,
	/** Builds a placed house. */
	createParcelHouseObject,
	/** Selects vertical sizing and the plan subdivision of a parcel house. */
	type ParcelHouseRecipe,
	/** A city parcel's occupied house or named reason why it remains garden. */
	type ParcelHouseResult,
	/** Parcel frontage, active columns, city datum, and optional metric terrain sampler. */
	type ParcelHouseSite,
	/** A private parcel house that fitted its frontage, ground and bay. */
	type PlacedParcelHouse
} from './parcel';
export {
	/** Places the private parcels of one town block using area-based scale. */
	createTownBlockHouses,
	/** Plans the houses and unbuildable parcels in one town block without deriving walls. */
	placeTownBlockHouses,
	/** Reads the occupied wall spans that lie on the parcel contour, in world meters. */
	readParcelHouseWalls
} from './block-houses';
/** Indexes the private parcels of a town for the shared house placement rule, including their addressed frontage, world-meter terrain sampler and area-based scale. */
export { createTownParcelSites } from './town-sites';
export {
	/** Reads three buildable examples from the default parcel plan at the requested valley relief. */
	createTownHouseStudy,
	/** The perimeter holding, its neighboring perimeter block, and the merged hall of the Town study. */
	type TownHouseBlock
} from './parcel-town';
/** Builds the mixed-use town house recipe within the site's coarse spacing. */
export { townHouseRecipe } from './town-program';
