import type { AssetEntry } from '../../core/asset-registry';
import { blockInputs } from '../../core/params';
import { createCellSpace } from '../../domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseStyles,
	type HouseStyle
} from '../../domain/house-court';

import { createParcelHouse, createParcelHouseObject } from '../house-site';
import type { CityAssetHost } from './hosts';

function courtHouse(style: HouseStyle): AssetEntry<CityAssetHost> {
	return {
		id: `house/court-${style.id}`,
		kind: 'house',
		tags: ['court', style.id],
		params: blockInputs,
		hostKinds: ['parcel', 'cell-space'],
		build(host, params, seed) {
			if (host.kind === 'parcel' && 'site' in host) {
				if (host.site.parcel.id !== host.parcel.id)
					throw new RangeError('Expected the site of the addressed parcel');
				return createParcelHouseObject(
					createParcelHouse(host.site, { ...params, seed }, style),
					'full'
				);
			}
			const space =
				host.kind === 'parcel'
					? createCellSpace(host.parcel)
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
