/** Module: Composes the city library’s public object builders into one placeable asset registry. */
import { createAssetRegistry } from '../../core/asset-registry';
import { courtHouses } from './houses';
import { accessAssets } from './access';
import { structuralAssets } from './structures';
import { surfaceAssets } from './plates';

export {
	InvalidAssetParamsError,
	UnknownAssetError,
	WrongAssetHostError,
	type AssetDefinition,
	type AssetFilter,
	type HostAddress,
	type Placement
} from '../../core/asset-registry';
export type { CityAssetHost } from './hosts';
export { placeParcelHouseAsset } from './houses';

/** Replay revision for the installed asset IDs, parameter schemas and builders. */
export const cityAssetRegistryRevision = 'city-assets/2';

const registry = createAssetRegistry([
	...courtHouses,
	...accessAssets,
	...surfaceAssets,
	...structuralAssets
]);

/** Lists city asset definitions matching the optional kind and tags. */
export const listAssets = registry.listAssets;
/** Reads one city asset definition by ID. */
export const readAsset = registry.readAsset;
/** Builds one city asset in world meters from a resolved host, overrides and seed. */
export const buildAsset = registry.buildAsset;

/** Checks whether the resolved host fits the asset before recording a placement. */
export const validateAssetHost = registry.validateHost;
