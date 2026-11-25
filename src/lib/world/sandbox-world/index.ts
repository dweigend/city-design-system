/** Module: Resolves sandbox addresses against a fixed city and builds registry placements. */
import { UnknownAssetError, type Placement } from '../../core/asset-registry';
import { resolveParams } from '../../core/params';
import { readWorldReference, type ReferenceResolution } from '../../core/ref';
import { createPolygonIndex } from '../../core/polygon-index';
import type { CityColumn } from '../../domain/city-volume';
import type { CellStorey, FineCell } from '../../domain/cell-space';
import { readHousePartRefs, type HousePartRef, type HouseStorey } from '../../domain/house-court';
import { planEdges, type PlanEdge } from '../../domain/terrain-grid';
import {
	createSandboxDocument,
	restoreSandboxDocument,
	readHostReference,
	type SandboxPlacement,
	UnavailableHostError
} from '../../domain/sandbox-document';
import {
	buildAsset,
	listAssets,
	placeParcelHouseAsset,
	readAsset,
	validateAssetHost,
	type CityAssetHost,
	type HostAddress
} from '../asset-registry';
import { readCityMovement } from '../city-movement';
import {
	createCityVerticalRecipe,
	readCityParcels,
	riverCityRecipe,
	type CityGrid,
	type CitySite
} from '../city-site';
import { createTownParcelSites, readParcelHouseWalls, type ParcelHouseRecipe } from '../house-site';
import { readSandboxIdentity } from './identity';

/** Maintains active objects by placement ID. */
export { createPlacementCache } from './cache';
/** A well-formed address cannot host a placement in the current snapshot. */
export { UnavailableHostError };

type TopologyHostKind = Exclude<HostAddress['kind'], 'ground'>;

type CityReferenceValue =
	| ReturnType<typeof readCityParcels>['parcels' | 'portals' | 'lanes' | 'blocks'][number]
	| CityGrid['selectedCrossings'][number]
	| PlanEdge
	| CityGrid['plan']['cells' | 'vertices'][number]
	| ReturnType<typeof readCityMovement>['network']['nodes' | 'edges'][number]
	| (CellStorey & { quad: FineCell['quad']; program?: HouseStorey })
	| HousePartRef;

function referenceOwner(key: string): string | undefined {
	try {
		const tuple: unknown = JSON.parse(key);
		return Array.isArray(tuple) && typeof tuple[0] === 'string' ? tuple[0] : undefined;
	} catch {
		return undefined;
	}
}

function byId<T extends { id: string }>(items: readonly T[]) {
	return new Map(items.map((item) => [item.id, item]));
}

function snapshotColumns(columns: ReadonlyMap<string, CityColumn>) {
	const snapshot = new Map<string, CityColumn>();
	for (const [id, column] of columns) {
		const corners = column.corners.map(({ position: [x, y, z], ...corner }) =>
			Object.freeze({ ...corner, position: Object.freeze([x, y, z] as const) })
		);
		snapshot.set(
			id,
			Object.freeze({
				...column,
				corners: Object.freeze(corners),
				neighbors: Object.freeze([...column.neighbors])
			})
		);
	}
	return snapshot;
}

/** Indexes the supplied city's private parcels and ground movement edges.
 * Detaches the column inputs and derives the save identity from the layout and terrain. Supply a stable revision for a custom
 * terrain sampler. Give snapshots of the same custom terrain a common ID to allow replay across revisions. */
export function createSandboxWorld(
	site: CitySite,
	layout: CityGrid,
	columns: ReadonlyMap<string, CityColumn>,
	customTerrainRevision?: string,
	customTerrainId?: string,
	houseRecipe?: ParcelHouseRecipe
) {
	const cityVertical = site.recipe ?? riverCityRecipe;
	const vertical = houseRecipe?.vertical
		? createCityVerticalRecipe({
				...houseRecipe.vertical,
				levelHeightM: houseRecipe.vertical.levelHeightM ?? cityVertical.levelHeightM
			})
		: cityVertical;
	if (vertical.levelHeightM !== cityVertical.levelHeightM)
		throw new RangeError('House and city coarse level spacing must agree');
	if ((houseRecipe?.storeyProgram || houseRecipe?.subgridCatalog) && !houseRecipe.key?.trim())
		throw new RangeError('A custom house program or subgrid catalog needs a stable recipe key');
	const recipe = Object.freeze({
		...houseRecipe,
		vertical,
		subgridOptions: houseRecipe?.subgridOptions && Object.freeze({ ...houseRecipe.subgridOptions })
	});
	for (const [key, column] of columns) {
		if (key !== column.planCellId || column.planScope !== layout.growth.planScope)
			throw new RangeError('City column belongs to a different plan');
	}
	const columnSnapshot = snapshotColumns(columns);
	const holdings = readCityParcels(site, layout);
	const polygons = createPolygonIndex(holdings.parcels, holdings.linearToleranceM);
	const readParcelSite = createTownParcelSites(
		holdings,
		columnSnapshot,
		layout.datumZ,
		([x, y]) => site.sampleGround(x, y).height,
		recipe
	);
	// Exact arithmetic: ground-only movement uses no vertical offset and no upper-level centers.
	const groundOffset = /* Exact arithmetic: zero offset places the asset on the ground. */ 0;
	const movement = readCityMovement(site, layout, [], groundOffset, undefined, []);
	const edges = new Map(movement.network.edges.map((edge) => [edge.id, edge]));
	const identity = readSandboxIdentity(
		site,
		layout,
		holdings,
		columnSnapshot,
		movement.network,
		recipe,
		customTerrainRevision,
		customTerrainId
	);
	const createDocument = () => createSandboxDocument(identity, prepare);

	const hosts = new Map<TopologyHostKind, (id: string) => CityAssetHost | undefined>([
		[
			'parcel',
			(id) => {
				const site = readParcelSite(id);
				return site && { kind: 'parcel', parcel: site.parcel, site };
			}
		],
		[
			'graph-edge',
			(id) => {
				const edge = edges.get(id);
				return edge && { kind: 'graph-edge', id, points: edge.points, supports: edge.supports };
			}
		]
	]);

	function resolveHost(host: HostAddress): CityAssetHost {
		const value = host.kind === 'ground' ? undefined : hosts.get(host.kind)?.(host.id);
		if (value) return value;
		throw new UnavailableHostError('Unavailable city host: ' + JSON.stringify(host));
	}

	function prepare(assetId: string, host: HostAddress, params: Placement['params']) {
		const definition = readAsset(assetId);
		const parameters = resolveParams(definition.params, params);
		const resolved = resolveHost(host);
		try {
			validateAssetHost(assetId, resolved);
		} catch (cause) {
			throw new UnavailableHostError('Asset cannot use this host: ' + assetId, { cause });
		}
		return parameters;
	}

	function matchesPlacement({ host, hostReference, registryRevision }: SandboxPlacement) {
		const expected = readHostReference(identity, host);
		return (
			hostReference.v === expected.v &&
			hostReference.world === expected.world &&
			hostReference.kind === expected.kind &&
			hostReference.key === expected.key &&
			registryRevision === identity.registryRevision
		);
	}

	function validatePlacement(placement: SandboxPlacement) {
		if (!matchesPlacement(placement))
			throw new UnavailableHostError('Placement has an incompatible reference or registry');
	}

	function resolveHouse(placement: SandboxPlacement) {
		validatePlacement(placement);
		const { assetId, host, params, seed } = placement;
		if (host.kind !== 'parcel' || readAsset(assetId).kind !== 'house') return undefined;
		const site = readParcelSite(host.id);
		if (!site) throw new UnavailableHostError('Unavailable house parcel: ' + host.id);
		return placeParcelHouseAsset(assetId, site, { ...prepare(assetId, host, params), seed });
	}

	function resolveAvailableHouse(placement: SandboxPlacement) {
		if (
			placement.host.kind !== 'parcel' ||
			!matchesPlacement(placement) ||
			!readParcelSite(placement.host.id)
		)
			return undefined;
		try {
			return resolveHouse(placement);
		} catch (error) {
			if (error instanceof UnavailableHostError || error instanceof UnknownAssetError)
				return undefined;
			throw error;
		}
	}

	function readHouseReference(
		kind: 'storey' | 'house-part',
		key: string,
		document: ReturnType<typeof createDocument>
	): CityReferenceValue | undefined {
		const owner = referenceOwner(key);
		const prefix = 'house/';
		const id =
			kind === 'storey'
				? owner
				: owner?.startsWith(prefix)
					? owner.slice(prefix.length)
					: undefined;
		if (!id) return undefined;
		const placement = document.readPlacement({ kind: 'parcel', id });
		if (!placement) return undefined;
		const placed = resolveAvailableHouse(placement);
		if (placed?.status !== 'placed') return undefined;
		if (kind === 'storey') {
			const storey = placed.space.storeys.find((row) => row.key === key);
			if (!storey) return undefined;
			const quad = placed.space.cells.find(({ id }) => id === storey.cellId)?.quad;
			if (!quad) return undefined;
			const program = placed.house.cells
				.find(({ id }) => id === storey.cellId)
				?.program?.find((row) => row.key === key);
			return { ...storey, quad, ...(program ? { program } : {}) };
		}
		const walls = document.readPlacements().flatMap((peer) => {
			if (
				peer.id === placement.id ||
				peer.host.kind !== 'parcel' ||
				holdingsById.get(peer.host.id)?.blockId !== placed.parcel.blockId
			)
				return [];
			const other = resolveAvailableHouse(peer);
			return other?.status === 'placed' ? readParcelHouseWalls(other) : [];
		});
		return readHousePartRefs(placed.house, identity.id, walls).find(({ ref }) => ref.key === key);
	}

	const holdingsById = byId(holdings.parcels);
	const addresses = new Map<string, ReadonlyMap<string, CityReferenceValue>>([
		['parcel', holdingsById],
		['portal', byId(holdings.portals)],
		['lane', byId(holdings.lanes)],
		['crossing', byId(layout.selectedCrossings)],
		['graph-node', byId(movement.network.nodes)],
		['graph-edge', edges],
		['bridge', byId(movement.network.edges.filter(({ kind }) => kind === 'bridge'))],
		['block', byId(holdings.blocks)],
		['plan-cell', byId(layout.plan.cells)],
		['plan-edge', byId(planEdges(layout.plan))],
		['shore-node', byId(layout.grid.vertices.filter(({ shore }) => shore !== undefined))],
		['plan-node', byId(layout.plan.vertices)]
	]);

	return Object.freeze({
		world: Object.freeze(identity),
		/** Creates an empty editable document using this world’s registry and snapshot. */
		createDocument,
		holdings,
		movement,
		polygons,
		/** Resolves registry inputs. A parcel host gets its own map of immutable column records. */
		resolveHost(host: HostAddress): CityAssetHost {
			const resolved = resolveHost(host);
			if (resolved.kind === 'parcel' && 'site' in resolved)
				return { ...resolved, site: { ...resolved.site, columns: new Map(columnSnapshot) } };
			return resolved;
		},
		/** Offers the registry assets that accept the given host kind. */
		listAssets: (kind: HostAddress['kind']) =>
			kind !== 'ground' && hosts.has(kind)
				? listAssets().filter(({ hostKinds }) => hostKinds.includes(kind))
				: [],
		/** Resolves terrain addresses against the world and building addresses against a document. */
		resolveReference(
			input: unknown,
			document?: ReturnType<typeof createDocument>
		): ReferenceResolution<CityReferenceValue> {
			const reference = readWorldReference(input);
			if (!reference) return { status: 'invalid-reference' };
			if (reference.world !== identity.id) return { status: 'different-world' };
			if (reference.kind === 'storey' || reference.kind === 'house-part') {
				if (
					document &&
					(document.world.id !== identity.id || document.world.planScope !== identity.planScope)
				)
					return { status: 'different-world' };
				if (
					document &&
					(document.world.registryRevision !== identity.registryRevision ||
						document.world.topologyRevision !== identity.topologyRevision ||
						document.world.terrainRevision !== identity.terrainRevision)
				)
					return { status: 'missing' };
				const value = document && readHouseReference(reference.kind, reference.key, document);
				return value ? { status: 'resolved', value } : { status: 'missing' };
			}
			const index = addresses.get(reference.kind);
			if (!index) return { status: 'unsupported-kind' };
			const value = index.get(reference.key);
			return value ? { status: 'resolved', value } : { status: 'missing' };
		},
		/** Creates a placement edit with resolved parameters to preserve its defaults in saves. */
		place(assetId: string, host: HostAddress, params: Placement['params'] = {}) {
			return {
				kind: 'place',
				assetId,
				host,
				params: prepare(assetId, host, params)
			} as const;
		},
		/** Resolves a city house's occupancy before contextual object building. Graph-edge assets
		 * have no house occupancy. A valid city address may return a named garden result. */
		resolveHouse,
		/** Builds a placed object against the fixed city via the registry. */
		build(placement: SandboxPlacement) {
			validatePlacement(placement);
			const { assetId, host, params, seed } = placement;
			return buildAsset(assetId, resolveHost(host), params, seed);
		},
		/** Restores a same-world document against this snapshot, retaining unavailable hosts as orphans. */
		restore(json: string) {
			return restoreSandboxDocument(json, identity, prepare, [
				// The grove adds a row without changing any of the earlier builders or schemas.
				'city-assets/2'
			]);
		}
	});
}
