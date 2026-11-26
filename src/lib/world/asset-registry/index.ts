/** Module: Composes the city library’s public object builders into one placeable asset registry. */
import {
	createAssetRegistry,
	type AssetBuild,
	type AssetDefinition,
	type AssetFilter
} from '../../core/asset-registry';
import type { Bounds3 } from '../../core/geometry';
import { groveAsset } from './grove';
import { sculptureAssets } from './sculptures';
import { courtHouses } from './houses';
import { accessAssets } from './access';
import { structuralAssets } from './structures';
import { plugInAsset, readPlugInBounds } from './plug-in';
import { surfaceAssets, type SpecimenMaterials } from './plates';
import type { CityAssetHost } from './hosts';

export {
	/** An override is malformed or the seed is invalid. */
	InvalidAssetParamsError,
	/** No asset is registered at the supplied ID. */
	UnknownAssetError,
	/** A known asset received a host of an unsupported kind. */
	WrongAssetHostError,
	/** Entry metadata. */
	type AssetDefinition,
	/** Exact kind and all requested tags. */
	type AssetFilter,
	/** Local host address, using world meters for a ground point or a stable topology ID. */
	type HostAddress,
	/** Rebuildable asset placement with a host, resolved parameters, and deterministic seed. */
	type Placement
} from '../../core/asset-registry';
/** A resolved city placement host. */
export type { CityAssetHost } from './hosts';
/** The material family and role assigned to each specimen slot. */
export type { SpecimenMaterials } from './plates';
/** Places a registered court-house style on a resolved city parcel. */
export { placeParcelHouseAsset } from './houses';
/** The shared lawn elevation above its sampled ground in meters. */
export { groveLawnLiftM } from './grove';
/** Reads the seeded tree positions, canopy radii and heights in plan meters. */
export { readGrovePlan } from './grove';

/** Replay revision for the installed asset IDs, parameter schemas and builders. */
export const cityAssetRegistryRevision = 'city-assets/4';

const registry = createAssetRegistry<CityAssetHost, SpecimenMaterials>([
	...courtHouses,
	groveAsset,
	...accessAssets,
	...surfaceAssets,
	...structuralAssets,
	...sculptureAssets,
	plugInAsset
]);

/** Filter for the city registry. Contextual assets require a resolved socket. */
export type CityAssetFilter = AssetFilter & Readonly<{ includeContextual?: boolean }>;

/** Lists matching city assets in registration order. Search a kind or request includeContextual
 * to include plug-ins. Unqualified listings keep the freestanding Blocks specimen catalogue. */
export function listAssets(
	filter: CityAssetFilter = {}
): readonly AssetDefinition<CityAssetHost>[] {
	const entries = registry.listAssets(filter);
	if (filter.kind === plugInAsset.kind || filter.includeContextual) return entries;
	return entries.filter(({ id }) => id !== plugInAsset.id);
}
/** Reads one city asset definition by ID. */
export const readAsset = registry.readAsset;
/** Builds one city asset in world meters from a resolved host, overrides and seed. */
export const buildAsset = registry.buildAsset;

/** Builds a city asset with its explicit material roles and any docking collision bounds. */
export function buildAssetResult(
	id: string,
	host: CityAssetHost,
	overrides: Parameters<typeof registry.buildAssetResult>[2],
	seed: number
): AssetBuild<SpecimenMaterials> & Readonly<{ bounds?: Bounds3 }> {
	const product = registry.buildAssetResult(id, host, overrides, seed);
	const bounds = readPlugInBounds(product.object);
	return bounds ? Object.freeze({ ...product, bounds }) : product;
}

/** Checks whether the resolved host fits the asset before recording a placement. */
export const validateAssetHost = registry.validateHost;
