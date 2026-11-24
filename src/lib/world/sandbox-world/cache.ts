import { readPartyWallExposure, type AdjoiningWall } from '../../domain/house-court';
import type {
	createSandboxDocument,
	PlacementChange,
	SandboxPlacement
} from '../../domain/sandbox-document';
import { readParcelHouseWalls, type ParcelHouseResult } from '../house-site';

type Source = {
	placement: SandboxPlacement;
	house: ParcelHouseResult | undefined;
	walls: readonly AdjoiningWall[];
};
type Entry<T> = Source & { exposure: string; object: T };

function blockId({ house }: Source) {
	return house?.status === 'placed' ? house.parcel.blockId : undefined;
}

/** Maintains active objects by placement ID. With a parcel occupancy resolver, stages all
 * incoming houses before deriving party walls and rebuilds surviving houses only when their
 * exposure changes. The cache attaches to one document, including any restored placements.
 * A failed preparation leaves the active objects untouched. */
export function createPlacementCache<T>(
	document: ReturnType<typeof createSandboxDocument>,
	build: (
		placement: SandboxPlacement,
		house: ParcelHouseResult | undefined,
		adjoiningWalls: readonly AdjoiningWall[]
	) => T,
	resolveHouse?: (placement: SandboxPlacement) => ParcelHouseResult | undefined
) {
	const entries = new Map<string, Entry<T>>();
	let changesMade: ReturnType<typeof apply>;

	function source(placement: SandboxPlacement): Source {
		const house = resolveHouse?.(placement);
		return {
			placement,
			house,
			walls: house?.status === 'placed' ? readParcelHouseWalls(house) : []
		};
	}

	function apply(changes: readonly PlacementChange[]) {
		const updates = new Map<string, Source | undefined>();
		const blocks = new Map<string, Source[]>();
		for (const { id, after } of changes) {
			const before = entries.get(id);
			if (before?.placement === after) continue;
			const next = after && source(after);
			updates.set(id, next);
			for (const value of [before, next]) {
				const block = value && blockId(value);
				if (block && !blocks.has(block)) blocks.set(block, []);
			}
		}

		const candidates = new Map(updates);
		for (const [id, entry] of entries) {
			const block = blockId(entry);
			if (block && blocks.has(block) && !updates.has(id)) candidates.set(id, entry);
		}
		for (const candidate of candidates.values()) {
			const block = candidate && blockId(candidate);
			if (block && candidate) blocks.get(block)?.push(candidate);
		}
		for (const group of blocks.values())
			group.sort(({ placement: a }, { placement: b }) => (a.id < b.id ? -1 : Number(a.id > b.id)));

		const built = new Map<string, Entry<T>>();
		const removed: string[] = [];
		for (const [id, candidate] of candidates) {
			if (!candidate) {
				removed.push(id);
				continue;
			}
			const { placement, house } = candidate;
			const group = blocks.get(blockId(candidate) ?? '') ?? [];
			const adjoining = group.flatMap((peer) => (peer === candidate ? [] : peer.walls));
			const exposure =
				house?.status === 'placed'
					? readPartyWallExposure(house.space, house.house, adjoining)
					: '';
			const previous = entries.get(id);
			if (previous?.placement === placement && previous.exposure === exposure) continue;
			built.set(id, { ...candidate, exposure, object: build(placement, house, adjoining) });
		}
		for (const id of removed) entries.delete(id);
		for (const [id, entry] of built) entries.set(id, entry);
		return { built: [...built.keys()], removed };
	}

	document.attach((changes) => {
		changesMade = apply(changes);
	});
	return Object.freeze({
		/** Reports the IDs built and removed by the last published document delta. */
		readChanges: () => changesMade,
		/** Returns the active products in stable placement ID order. */
		read: () =>
			Array.from(entries.keys())
				.sort()
				.flatMap((id) => {
					const entry = entries.get(id);
					return entry ? [entry.object] : [];
				})
	});
}
