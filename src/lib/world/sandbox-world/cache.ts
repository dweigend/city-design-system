import type { PlacementChange, SandboxPlacement } from '../../domain/sandbox-document';

/** Maintains active objects by placement record. All required builds finish before the cache
 * changes. A removal discards its object. Undo and redo build only arriving records. */
export function createPlacementCache<T>(build: (placement: SandboxPlacement) => T) {
	const entries = new Map<string, { placement: SandboxPlacement; object: T }>();
	return Object.freeze({
		/** Applies a document delta and reports the identities built and removed. */
		apply(changes: readonly PlacementChange[]) {
			const built = changes.flatMap(({ id, after }) => {
				if (!after || entries.get(id)?.placement === after) return [];
				return [{ id, placement: after, object: build(after) }];
			});
			const removed: string[] = [];
			for (const { id, after } of changes) if (!after && entries.delete(id)) removed.push(id);
			for (const { id, ...entry } of built) entries.set(id, entry);
			return { built: built.map(({ id }) => id), removed };
		},
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
