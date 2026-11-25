import { readPartyWallExposure, type AdjoiningWall } from '../../domain/house-court';
import {
	hasSamePlacementStructure,
	type createSandboxDocument,
	type PlacementChange,
	type SandboxPlacement
} from '../../domain/sandbox-document';
import { readParcelHouseWalls, type ParcelHouseResult } from '../house-site';

type Source = {
	placement: SandboxPlacement;
	house: ParcelHouseResult | undefined;
	walls: readonly AdjoiningWall[];
};
type Entry<T> = Source & { exposure: string; adjoining: readonly AdjoiningWall[]; object: T };

function blockId({ house }: Source) {
	return house?.status === 'placed' ? house.parcel.blockId : undefined;
}

/** Maintains active objects by placement ID. With a parcel occupancy resolver, stages all
 * incoming houses before deriving party walls and rebuilds surviving houses only when their
 * exposure changes. Finish-only edits reuse occupancy and exposure, and can restyle the cached
 * product. When no restyler is supplied, the cache retains the structural product as-is.
 * The cache attaches to one document, including any restored placements.
 * A failed preparation leaves the active objects untouched. */
export function createPlacementCache<T>(
	document: ReturnType<typeof createSandboxDocument>,
	build: (
		placement: SandboxPlacement,
		house: ParcelHouseResult | undefined,
		adjoiningWalls: readonly AdjoiningWall[]
	) => T,
	resolveHouse?: (placement: SandboxPlacement) => ParcelHouseResult | undefined,
	restyle?: (object: T, placement: SandboxPlacement) => T
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
		const finishOnly = new Set<string>();
		for (const { id, after } of changes) {
			const before = entries.get(id);
			if (before?.placement === after) continue;
			if (
				before &&
				after &&
				hasSamePlacementStructure(before.placement, after) &&
				JSON.stringify(before.placement.finishOverrides) !== JSON.stringify(after.finishOverrides)
			) {
				updates.set(id, { ...before, placement: after });
				finishOnly.add(id);
				continue;
			}
			const next = after && source(after);
			updates.set(id, next);
			for (const value of [before, next]) {
				const block = value && blockId(value);
				if (block && !blocks.has(block)) blocks.set(block, []);
			}
		}

		const candidates = new Map(updates);
		if (blocks.size)
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
		const restyled = new Map<string, Entry<T>>();
		const removed: string[] = [];
		for (const [id, candidate] of candidates) {
			if (!candidate) {
				removed.push(id);
				continue;
			}
			const { placement, house } = candidate;
			const previous = entries.get(id);
			const block = blockId(candidate);
			const group = block && blocks.get(block);
			const adjoining = group
				? group.flatMap((peer) => (peer === candidate ? [] : peer.walls))
				: finishOnly.has(id)
					? (previous?.adjoining ?? [])
					: [];
			const exposure =
				group && house?.status === 'placed'
					? readPartyWallExposure(house.space, house.house, adjoining)
					: finishOnly.has(id)
						? (previous?.exposure ?? '')
						: '';
			if (previous?.exposure === exposure && finishOnly.has(id)) {
				const object = restyle ? restyle(previous.object, placement) : previous.object;
				restyled.set(id, { ...candidate, exposure, adjoining, object });
				continue;
			}
			if (previous?.placement === placement && previous.exposure === exposure) continue;
			built.set(id, {
				...candidate,
				exposure,
				adjoining,
				object: build(placement, house, adjoining)
			});
		}
		for (const id of removed) entries.delete(id);
		for (const [id, entry] of built) entries.set(id, entry);
		for (const [id, entry] of restyled) entries.set(id, entry);
		return { built: [...built.keys()], removed, restyled: [...restyled.keys()] };
	}

	document.attach((changes) => {
		changesMade = apply(changes);
	});
	return Object.freeze({
		/** Reports the IDs built, restyled and removed by the last published document delta. */
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
