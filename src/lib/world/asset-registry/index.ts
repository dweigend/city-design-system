/** Module: Composes the city library’s public object builders into one placeable asset registry. */
import { createAssetRegistry } from '../../core/asset-registry';
import { groveAsset } from './grove';
import { courtHouses } from './houses';
import { accessAssets } from './access';
import { structuralAssets } from './structures';
import { surfaceAssets, type SpecimenMaterials } from './plates';
import type { CityAssetHost } from './hosts';

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
export type { SpecimenMaterials } from './plates';
export { placeParcelHouseAsset } from './houses';
/** The shared lawn elevation above its sampled ground in meters. */
export { groveLawnLiftM } from './grove';

/** Replay revision for the installed asset IDs, parameter schemas and builders. */
export const cityAssetRegistryRevision = 'city-assets/3';

const registry = createAssetRegistry<CityAssetHost, SpecimenMaterials>([
	...courtHouses,
	groveAsset,
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

/** Builds a city asset with its explicit material roles, when supplied by the builder. */
export const buildAssetResult = registry.buildAssetResult;

/** Checks whether the resolved host fits the asset before recording a placement. */
export const validateAssetHost = registry.validateHost;
