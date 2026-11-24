/** Module: Composes the city library’s public object builders into one placeable asset registry. */
import { createAssetRegistry } from '../../core/asset-registry';
import { courtHouses } from './houses';

export {
	InvalidAssetParamsError,
	UnknownAssetError,
	WrongAssetHostError,
	type AssetDefinition,
	type AssetFilter,
	type HostAddress,
	type Placement
} from '../../core/asset-registry';
export type { CityAssetHost } from './houses';

const registry = createAssetRegistry(courtHouses);

/** Lists city asset definitions matching the optional kind and tags. */
export const listAssets = registry.listAssets;
/** Reads one city asset definition by ID. */
export const readAsset = registry.readAsset;
/** Builds one city asset in world meters from a resolved host, overrides and seed. */
export const buildAsset = registry.buildAsset;
