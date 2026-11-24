/** Module: Resolves sandbox addresses against a fixed city and builds registry placements. */
import type { Placement } from '../../core/asset-registry';
import { resolveParams } from '../../core/params';
import { createPolygonIndex } from '../../core/polygon-index';
import type { CityColumn } from '../../domain/city-volume';
import {
	createSandboxDocument,
	restoreSandboxDocument,
	type SandboxPlacement,
	type WorldIdentity
} from '../../domain/sandbox-document';
import {
	buildAsset,
	listAssets,
	readAsset,
	type CityAssetHost,
	type HostAddress
} from '../asset-registry';
import { readCityMovement } from '../city-movement';
import { readCityParcels, type CityGrid, type CitySite } from '../city-site';

export { createPlacementCache } from './cache';

/** An address is absent or cannot host a placement in this fixed city. */
export class UnavailableHostError extends Error {
	override name = 'UnavailableHostError';
}

/** Indexes the supplied city's private parcels and ground movement edges.
 * The caller supplies the city's fixed terrain, selected layout and columns. */
export function createSandboxWorld(
	identity: WorldIdentity,
	site: CitySite,
	layout: CityGrid,
	columns: ReadonlyMap<string, CityColumn>
) {
	if (identity.seed !== layout.seed || identity.planFamily !== layout.variant)
		throw new RangeError('World identity does not match the selected plan');
	const world = createSandboxDocument(identity).world;
	const holdings = readCityParcels(site, layout);
	const polygons = createPolygonIndex(holdings.parcels, holdings.linearToleranceM);
	const parcels = new Map(holdings.parcels.map((parcel) => [parcel.id, parcel]));
	const blocks = new Map(holdings.blocks.map((block) => [block.id, block]));
	const portals = new Map(holdings.portals.map((portal) => [portal.id, portal]));
	// Exact arithmetic: ground-only movement uses no vertical offset and no upper-level centers.
	const groundOffset = 0;
	const movement = readCityMovement(site, layout, [], groundOffset, undefined, []);
	const edges = new Map(movement.network.edges.map((edge) => [edge.id, edge]));

	function resolveHost(host: HostAddress): CityAssetHost {
		if (host.kind === 'parcel') {
			const parcel = parcels.get(host.id);
			const block = parcel && blocks.get(parcel.blockId);
			const portal = parcel && portals.get(parcel.portalId);
			if (parcel && !parcel.publicUse && block && portal)
				return {
					kind: 'parcel',
					parcel,
					site: {
						parcel,
						block,
						portal,
						columns,
						datumZ: layout.datumZ,
						linearToleranceM: holdings.linearToleranceM
					}
				};
		}
		if (host.kind === 'graph-edge') {
			const edge = edges.get(host.id);
			if (edge)
				return { kind: host.kind, id: edge.id, points: edge.points, supports: edge.supports };
		}
		throw new UnavailableHostError('Unavailable city host: ' + JSON.stringify(host));
	}

	function prepare(assetId: string, host: HostAddress, params: Placement['params']) {
		const resolved = resolveHost(host);
		const definition = readAsset(assetId);
		if (!definition.hostKinds.includes(resolved.kind))
			throw new UnavailableHostError('Asset cannot use this host: ' + assetId);
		return resolveParams(definition.params, params);
	}

	return Object.freeze({
		world,
		holdings,
		movement,
		polygons,
		/** Resolves a city parcel or addressed movement edge into registry inputs. */
		resolveHost,
		/** Offers the registry assets that accept the given host kind. */
		listAssets: (kind: HostAddress['kind']) =>
			listAssets().filter(({ hostKinds }) => hostKinds.includes(kind)),
		/** Creates a placement edit with resolved parameters to preserve its defaults in saves. */
		place(assetId: string, host: HostAddress, params: Placement['params'] = {}) {
			return {
				kind: 'place',
				assetId,
				host,
				params: prepare(assetId, host, params)
			} as const;
		},
		/** Builds a placed object against the fixed city via the registry. */
		build({ assetId, host, params, seed }: SandboxPlacement) {
			return buildAsset(assetId, resolveHost(host), params, seed);
		},
		/** Restores the log for this world and validates transaction results, including redo. */
		restore(json: string) {
			return restoreSandboxDocument(json, world, (changes) => {
				for (const { after } of changes)
					if (after) prepare(after.assetId, after.host, after.params);
			});
		}
	});
}
