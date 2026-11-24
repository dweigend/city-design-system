import type { CityColumn } from '../../domain/city-volume';
import type { MovementEdge } from '../../domain/movement-network';
import type { ParcelPlan } from '../../domain/parcels';
import type { WorldIdentity } from '../../domain/sandbox-document';
import { coarseCellSize, type CityGrid, type CitySite } from '../city-site';
import { cityAssetRegistryRevision } from '../asset-registry';

// Bump when a generator can reuse a local key for a different feature.
const planAddressRevision = 'city-plan/1';

// Exact arithmetic: FNV-1a over UTF-8, reduced to its unsigned 64-bit state at each step.
function fingerprint(snapshot: unknown) {
	const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
	let hash = 0xcbf29ce484222325n;
	for (const byte of bytes) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
	return hash.toString(16);
}

/** Identifies the resolved terrain and topology used for parcel and edge placement. */
export function readSandboxIdentity(
	site: CitySite,
	layout: CityGrid,
	holdings: ParcelPlan,
	columns: ReadonlyMap<string, CityColumn>,
	edges: readonly MovementEdge[],
	customTerrainRevision?: string,
	customTerrainId?: string
): WorldIdentity {
	const valley = site.valley;
	if (!valley && !customTerrainRevision?.trim())
		throw new RangeError('A custom terrain needs a stable revision for sandbox saves');
	const terrainRevision = valley
		? JSON.stringify(['valley', valley.revision, valley.seed, valley.parameters])
		: JSON.stringify(['custom', customTerrainRevision]);
	const topologyRevision = fingerprint({
		citySize: layout.citySize,
		plan: layout.plan,
		grid: layout.grid,
		holdings,
		datumZ: layout.datumZ,
		columns: [...columns].sort(([a], [b]) => (a < b ? -1 : Number(a > b))),
		edges
	});
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
