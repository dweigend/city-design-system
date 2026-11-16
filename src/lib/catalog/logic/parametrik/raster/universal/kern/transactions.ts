import { deriveChunk, validateIntent } from './model';
import { InvariantError, type Model, type Vec, type Meaning } from './types';
export type Edit = {
	positions?: ReadonlyMap<string, Vec>;
	meanings?: ReadonlyMap<string, Meaning>;
};
export type Transaction = {
	before: Model;
	after: Model;
	dirty: readonly string[];
	rebuilt: number;
};
/** Canonical rederivation only of the vertex->source dependency closure. */
export function transact(before: Model, edit: Edit): Transaction {
	const positions = new Map(before.intent.positions),
		semantics = new Map(before.semantics),
		dirty = new Set<string>();
	for (const [id, p] of edit.positions ?? []) {
		const deps = before.dependencies.get(id);
		if (!deps) throw new InvariantError('unknown-vertex', [id]);
		if (before.intent.fixed.has(id) || deps.some((f) => before.semantics.get(f)!.protected))
			throw new InvariantError('protected', [id]);
		if (p.length !== 2 || !p.every(Number.isFinite))
			throw new InvariantError('invalid-position', [id]);
		positions.set(id, [...p]);
		deps.forEach((f) => dirty.add(f));
	}
	for (const [id, m] of edit.meanings ?? []) {
		if (!semantics.has(id) || semantics.get(id)!.protected)
			throw new InvariantError('protected-or-unknown-meaning', [id]);
		semantics.set(id, structuredClone(m));
	}
	const intent = { ...before.intent, positions, semantics };
	validateIntent(intent, dirty);
	const chunks = new Map(before.chunks);
	for (const id of [...dirty].sort()) chunks.set(id, deriveChunk(intent, intent.faces.get(id)!));
	const after = { ...before, intent, chunks, semantics };
	return { before, after, dirty: [...dirty].sort(), rebuilt: dirty.size };
}
/** Undo/redo keeps exact snapshots, including derivation choices; stale histories reject. */
export function undo(current: Model, t: Transaction): Model {
	if (current !== t.after) throw new InvariantError('stale-undo');
	return t.before;
}
export function redo(current: Model, t: Transaction): Model {
	if (current !== t.before) throw new InvariantError('stale-redo');
	return t.after;
}
