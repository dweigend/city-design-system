import type { AssetEntry, AssetHost } from '../../core/asset-registry';
import { blockInputs } from '../../core/params';
import { createCellSpace, type CellSpace, type Parcel } from '../../domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseStyles,
	type HouseStyle
} from '../../domain/house-court';

/** Resolved city asset host. Parcel and cell-space data come from the domain contracts. */
export type CityAssetHost = AssetHost<Parcel, CellSpace>;

function courtHouse(style: HouseStyle): AssetEntry<CityAssetHost> {
	return {
		id: `house/court-${style.id}`,
		kind: 'house',
		tags: ['court', style.id],
		params: blockInputs,
		hostKinds: ['parcel', 'cell-space'],
		build(host, params, seed) {
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
