import { UnknownAssetError, type AssetEntry } from '../../core/asset-registry';
import { createBlockInputs } from '../../core/params';
import { createSubgridSpace } from '../../domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseStyles,
	type HouseInputs,
	type HouseStyle
} from '../../domain/house-court';

import { createParcelHouse, createParcelHouseObject, type ParcelHouseSite } from '../house-site';
import type { CityAssetHost } from './hosts';

const blockInputs = createBlockInputs();

const houseId = ({ id }: HouseStyle) => `house/court-${id}`;
const stylesByAssetId = new Map(Object.values(houseStyles).map((style) => [houseId(style), style]));

/** Places a registered court-house style on a resolved city parcel. Returns occupancy and
 * site geometry so a caller can derive party-wall contacts before building the object. */
export function placeParcelHouseAsset(assetId: string, site: ParcelHouseSite, inputs: HouseInputs) {
	const style = stylesByAssetId.get(assetId);
	if (!style) throw new UnknownAssetError('No parcel house style for ' + assetId);
	return createParcelHouse(site, inputs, style);
}

function courtHouse(style: HouseStyle): AssetEntry<CityAssetHost> {
	return {
		id: houseId(style),
		kind: 'house',
		tags: ['court', style.id],
		params: blockInputs,
		hostKinds: ['parcel', 'cell-space'],
		validateHost(host) {
			if ('groundAt' in host) throw new RangeError('A house needs a structural parcel');
		},
		build(host, params, seed) {
			if (host.kind === 'parcel' && 'site' in host) {
				if (host.site.parcel.id !== host.parcel.id)
					throw new RangeError('Expected the site of the addressed parcel');
				const placed = placeParcelHouseAsset(houseId(style), host.site, { ...params, seed });
				if (placed.status === 'unbuildable')
					throw new RangeError('Unbuildable parcel: ' + placed.reason);
				return createParcelHouseObject(placed, 'full');
			}
			const space =
				host.kind === 'parcel' && !('groundAt' in host)
					? createSubgridSpace(
							host.parcel,
							host.subgridId ?? 'corner-quad',
							host.subgridOptions,
							host.subgridCatalog
						)
					: host.kind === 'cell-space'
						? host.space
						: undefined;
			if (!space) throw new RangeError('Court houses require a parcel or a cell-space');
			const house = createHouseCourt(space, { ...params, seed }, style);
			return createHouseObject(space, house, 'full', style);
		}
	};
}

export const courtHouses = Object.values(houseStyles).map(courtHouse);
