import { required } from '../../core/invariant';
import { createParcelHouse, createTownHouseStudy } from './index';

// The first parcel on the default Town's perimeter block.
export function example() {
	const town = createTownHouseStudy();
	const parcel = required(town.parcelsByBlock.get(town.blocks.block.id)?.[0], 'town parcel');
	const site = required(town.readParcelSite(parcel.id), 'parcel site');
	return createParcelHouse(site, { height: 14, width: 30, complexity: 0.5, seed: 4 });
}
