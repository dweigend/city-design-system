import type { CityColumn } from '../../domain/city-volume';
import type { MovementEdge } from '../../domain/movement-network';
import type { ParcelPlan } from '../../domain/parcels';
import type { WorldIdentity } from '../../domain/sandbox-document';
import type { CityGrid, CitySite } from '../city-site';

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
	customTerrainRevision?: string
): WorldIdentity {
	const valley = site.valley;
	if (!valley && !customTerrainRevision?.trim())
		throw new RangeError('A custom terrain needs a stable revision for sandbox saves');
	const terrainRevision = valley
		? JSON.stringify(['valley', valley.revision, valley.seed, valley.parameters])
		: JSON.stringify(['custom', customTerrainRevision]);
	const topologyRevision = fingerprint({
		frame: site.frame,
		origin: site.origin,
		holdings,
		datumZ: layout.datumZ,
		columns: [...columns].sort(([a], [b]) => (a < b ? -1 : Number(a > b))),
		edges
	});
	return {
		seed: layout.seed,
		planFamily: layout.variant,
		citySize: layout.citySize,
		terrainRevision,
		topologyRevision
	};
}
