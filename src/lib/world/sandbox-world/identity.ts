import type { CityColumn } from '../../domain/city-volume';
import type { MovementNetwork } from '../../domain/movement-network';
import type { ParcelPlan } from '../../domain/parcels';
import type { WorldIdentity } from '../../domain/sandbox-document';
import type { TerrainGrid } from '../../domain/terrain-grid';
import { coarseCellSize, type CityGrid, type CitySite } from '../city-site';
import { cityAssetRegistryRevision } from '../asset-registry';

// Bump when a generator can reuse a local key for a different feature.
const planAddressRevision = 'city-plan/1';

// Exact arithmetic: FNV-1a over UTF-8, reduced to its unsigned 64-bit state at each step.
function fingerprint(snapshot: unknown) {
	const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
	let hash = 0xcbf29ce484222325n;
	for (const byte of bytes)
		hash = BigInt.asUintN(
			/* Exact arithmetic: FNV-1a word width. */ 64,
			(hash ^ BigInt(byte)) * 0x100000001b3n
		);
	return hash.toString(/* Exact arithmetic: hexadecimal revision representation. */ 16);
}

function byId<T extends { id: string }>(items: readonly T[]) {
	return [...items].sort((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id)));
}

function gridTopology(grid: TerrainGrid) {
	return [
		byId(grid.vertices).map(({ id, shore }) => [id, shore?.planEdgeId ?? null]),
		byId(grid.cells).map(({ id, vertexIds, neighbors, groundKind }) => [
			id,
			vertexIds,
			neighbors,
			groundKind ?? null
		])
	];
}

// Sort address sets by code unit. Keep directed rings and paths in traversal order.
function holdingTopology(holdings: ParcelPlan) {
	return [
		byId(holdings.blocks).map(({ id, memberCellIds, nodeIds, publicGround }) => [
			id,
			[...memberCellIds].sort(),
			nodeIds,
			publicGround.entrance ? [publicGround.entrance.id, publicGround.entrance.laneId] : null
		]),
		byId(holdings.parcels).map(({ id, blockId, portalId, publicUse, corners }) => [
			id,
			blockId,
			portalId,
			publicUse,
			corners.map(({ id }) => id)
		]),
		byId(holdings.portals).map(({ id, parcelId, laneId, side }) => [id, parcelId, laneId, side]),
		byId(holdings.lanes).map(({ id, edgeId, nodeIds, blockIds }) => [
			id,
			edgeId,
			[...nodeIds].sort(),
			[...blockIds].sort()
		])
	];
}

function columnTopology(columns: ReadonlyMap<string, CityColumn>) {
	return [...columns]
		.sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
		.map(([id, column]) => {
			const { planCellId, districtId, densityRegionId, levels, corners, neighbors } = column;
			return [
				id,
				planCellId,
				districtId,
				densityRegionId,
				levels,
				corners.map(({ id }) => id),
				neighbors
			];
		});
}

/** Identifies the resolved terrain and topology used for parcel and edge placement. */
export function readSandboxIdentity(
	site: CitySite,
	layout: CityGrid,
	holdings: ParcelPlan,
	columns: ReadonlyMap<string, CityColumn>,
	network: MovementNetwork,
	customTerrainRevision?: string,
	customTerrainId?: string
): WorldIdentity {
	const valley = site.valley;
	if (!valley && !customTerrainRevision?.trim())
		throw new RangeError('A custom terrain needs a stable revision for sandbox saves');
	const { sinuosity, relief, runoff } = valley?.parameters ?? {};
	const terrainRevision = valley
		? JSON.stringify(['valley', valley.revision, valley.seed, { sinuosity, relief, runoff }])
		: JSON.stringify(['custom', customTerrainRevision]);
	const topologyRevision = fingerprint([
		gridTopology(layout.plan),
		gridTopology(layout.grid),
		byId(layout.selectedCrossings).map(({ id, heads, span }) => [
			id,
			heads.map(({ nodeId, cellIds }) => [nodeId, [...cellIds].sort()]),
			span?.nodeIds ?? null
		]),
		holdingTopology(holdings),
		columnTopology(columns),
		byId(network.nodes).map(({ id }) => id),
		byId(network.edges).map(({ id, kind, nodeIds }) => [id, kind, [...nodeIds].sort()])
	]);
	return {
		id: JSON.stringify([
			planAddressRevision,
			layout.seed,
			layout.variant,
			coarseCellSize,
			site.origin,
			site.frame.bearing,
			valley ? ['valley', valley.seed] : ['custom', customTerrainId ?? customTerrainRevision]
		]),
		seed: layout.seed,
		registryRevision: cityAssetRegistryRevision,
		terrainRevision,
		topologyRevision
	};
}
