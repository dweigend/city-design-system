/** Module: Records reversible, world-scoped edits to addressed asset placements. */
import type { HostAddress, Placement } from '../../core/asset-registry';
import { readWorldReference, type ReferenceResolution } from '../../core/ref';
import {
	edit,
	replace,
	placement,
	readPlacementId,
	readHostReference,
	readParams,
	record,
	replayEdit,
	savedEdit,
	SandboxDataError,
	worldIdentity,
	type PlacementChange,
	type SandboxEdit,
	type SandboxPlacement,
	type WorldIdentity
} from './records';

export {
	SandboxDataError,
	type PlacementChange,
	type SandboxEdit,
	type SandboxPlacement,
	type WorldIdentity
};

/** The requested address already hosts its single placement. */
export class OccupiedHostError extends Error {
	override name = 'OccupiedHostError';
}

/** The requested placement is absent in the current transaction. */
export class MissingPlacementError extends Error {
	override name = 'MissingPlacementError';
}

type Transaction = Readonly<{ edits: readonly SandboxEdit[]; changes: readonly PlacementChange[] }>;
type Prepare = (changes: readonly PlacementChange[]) => void;
type ResolveParams = (
	assetId: string,
	host: HostAddress,
	params: Placement['params']
) => Placement['params'];
const format = 'sandbox/3';
const noChanges: readonly PlacementChange[] = Object.freeze([]);

export { readHostReference, readPlacementId };

/** A well-formed address cannot host a placement in the current snapshot. */
export class UnavailableHostError extends Error {
	override name = 'UnavailableHostError';
}

/** A prior format used incompatible slot and movement IDs. */
export class UnsupportedSandboxVersionError extends SandboxDataError {
	override name = 'UnsupportedSandboxVersionError';
}

/** Creates an empty document. Each exact host has one slot. A transaction is atomic.
 * A caller may prepare the derived state from the change list before the transaction takes effect.
 * The optional resolver validates and canonicalizes every staged placement and replacement.
 * Callbacks can read the document. A nested write throws SandboxDataError.
 * If preparation throws, the document and its history retain their prior state. */
export function createSandboxDocument(identity: WorldIdentity, resolveParams?: ResolveParams) {
	return createDocument(identity, resolveParams);
}

function createDocument(
	identity: WorldIdentity,
	resolveParams?: ResolveParams,
	replaying?: () => boolean
) {
	const world = worldIdentity(identity);
	const placements = new Map<string, SandboxPlacement>();
	const history: Transaction[] = [];
	const orphans = new WeakSet<SandboxPlacement>();
	const available = (record: SandboxPlacement | undefined) =>
		record && !orphans.has(record) ? record : undefined;
	let position = 0;
	let orphanCount = 0;
	let projection: Prepare | undefined;
	let writing = false;

	function write<T>(operation: () => T): T {
		if (writing) throw new SandboxDataError('Sandbox document write already in progress');
		writing = true;
		try {
			return operation();
		} finally {
			writing = false;
		}
	}

	function publish(changes: readonly PlacementChange[], prepare?: Prepare) {
		if (projection && prepare)
			throw new SandboxDataError('This document already owns a projection');
		const project = projection ?? prepare;
		if (project) {
			const visible = changes.flatMap((change) => {
				const { id, before, after } = change;
				const prior = available(before);
				const next = available(after);
				if (prior === next) return [];
				return [
					before === prior && after === next
						? change
						: Object.freeze({ id, before: prior, after: next })
				];
			});
			project(Object.freeze(visible));
		}
		for (const { id, before, after } of changes) {
			orphanCount +=
				Number(after !== undefined && orphans.has(after)) -
				Number(before !== undefined && orphans.has(before));
			if (after) placements.set(id, after);
			else placements.delete(id);
		}
		return changes;
	}

	function preparePlacement(assetId: string, host: HostAddress, params: Placement['params']) {
		try {
			return { params: resolveParams ? readParams(resolveParams(assetId, host, params)) : params };
		} catch (error) {
			if (!replaying?.() || !(error instanceof UnavailableHostError)) throw error;
			return { params, orphan: true };
		}
	}

	function stage(input: readonly SandboxEdit[]) {
		const edits: SandboxEdit[] = [];
		const staged = new Map<string, SandboxPlacement | undefined>();
		const current = (id: string) => (staged.has(id) ? staged.get(id) : placements.get(id));
		for (const raw of input) {
			const operation = edit(raw);
			if (operation.kind === 'place') {
				const { params, orphan } = preparePlacement(
					operation.assetId,
					operation.host,
					operation.params
				);
				const after = placement(world, { ...operation, params });
				if (current(after.id)) throw new OccupiedHostError('Host already occupied: ' + after.id);
				if (orphan) orphans.add(after);
				edits.push(Object.freeze({ ...operation, params, seed: after.seed }));
				staged.set(after.id, after);
				continue;
			}
			const { id } = operation;
			const before = current(id);
			if (!before) throw new MissingPlacementError('Missing placement: ' + id);
			if (operation.kind === 'remove') {
				edits.push(operation);
				staged.set(id, undefined);
				continue;
			}
			const { params, orphan } = preparePlacement(before.assetId, before.host, operation.params);
			const resolved = Object.freeze({ ...operation, params });
			const after = replace(before, resolved);
			if (orphan) orphans.add(after);
			edits.push(resolved);
			staged.set(id, after);
		}
		const changes = Object.freeze(
			Array.from(staged, ([id, after]) =>
				Object.freeze({
					id,
					before: placements.get(id),
					after
				})
			).filter(({ before, after }) => before !== after)
		);
		return { edits: Object.freeze(edits), changes };
	}

	function records(orphan: boolean) {
		return [...placements.values()]
			.filter((record) => orphans.has(record) === orphan)
			.sort((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id)));
	}

	function applyStroke(mode: 'apply' | 'amend', input: readonly SandboxEdit[], prepare?: Prepare) {
		const { edits, changes } = stage(input);
		if (!changes.length) return noChanges;
		publish(changes, prepare);
		if (mode === 'apply' || position === 0) {
			history.splice(position, history.length - position, { edits, changes });
			position++;
			return changes;
		}
		const previous = history[position - 1];
		const merged = new Map(previous.changes.map((change) => [change.id, change]));
		for (const { id, before, after } of changes) {
			const first = merged.has(id) ? merged.get(id)?.before : before;
			merged.set(id, Object.freeze({ id, before: first, after }));
		}
		const net = Object.freeze([...merged.values()].filter((c) => c.before !== c.after));
		const next = { edits: Object.freeze([...previous.edits, ...edits]), changes: net };
		history.splice(position - 1, history.length - position + 1, ...(net.length ? [next] : []));
		if (!net.length) position--;
		return changes;
	}

	return Object.freeze({
		world,
		/** Attaches one derived projection to this document and initializes it from active records.
		 * All later changes prepare that projection before publishing history. */
		attach(prepare: Prepare) {
			write(() => {
				if (projection) throw new SandboxDataError('This document already owns a projection');
				prepare(records(false).map((after) => ({ id: after.id, before: undefined, after })));
				projection = prepare;
			});
		},
		/** Reads one active, usable placement for a local host address. */
		readPlacement: (host: HostAddress) => available(placements.get(readPlacementId(world, host))),
		/** Lists usable placements in stable ID order. */
		readPlacements: () => records(false),
		/** Lists retained records whose hosts cannot be used in the current snapshot. */
		readOrphans: () => records(true),
		/** Resolves a placement reference against the current history position. */
		resolveReference(input: unknown): ReferenceResolution<SandboxPlacement> {
			const reference = readWorldReference(input);
			if (!reference) return { status: 'invalid-reference' };
			if (reference.world !== world.id) return { status: 'different-world' };
			if (reference.kind !== 'placement') return { status: 'unsupported-kind' };
			const value = available(placements.get(reference.key));
			return value ? { status: 'resolved', value } : { status: 'missing' };
		},
		/** Counts usable placements, total transactions and the number currently applied. */
		readHistory: () => ({
			placements: placements.size - orphanCount,
			strokes: history.length,
			position
		}),
		/** Applies one ordered stroke, drops redo on a state change, and returns its net changes. */
		apply(input: readonly SandboxEdit[], prepare?: Prepare) {
			return write(() => applyStroke('apply', input, prepare));
		},
		/** Extends the last applied transaction with more edits, so a gesture that grows over time
		 * stays one undo step. Publishes and returns only the new net changes. Without an applied
		 * transaction it applies a new one. It drops the redo tail like `apply`. A transaction whose
		 * merged edits cancel out leaves the history. */
		amend(input: readonly SandboxEdit[], prepare?: Prepare) {
			return write(() => applyStroke('amend', input, prepare));
		},
		/** Reverses the last applied transaction. Returns its inverse change list. */
		undo(prepare?: Prepare) {
			return write(() => {
				if (position === 0) return noChanges;
				const inverse = Object.freeze(
					history[position - 1].changes.map(({ id, before, after }) =>
						Object.freeze({ id, before: after, after: before })
					)
				);
				publish(inverse, prepare);
				position--;
				return inverse;
			});
		},
		/** Reapplies the next transaction and returns its change list. */
		redo(prepare?: Prepare) {
			return write(() => {
				if (position === history.length) return noChanges;
				const changes = publish(history[position].changes, prepare);
				position++;
				return changes;
			});
		},
		/** Serializes the full edit log including redo and the current position. */
		serialize() {
			return JSON.stringify({
				format,
				world,
				strokes: history.map(({ edits }) => edits.map((operation) => savedEdit(operation, world))),
				position
			});
		}
	});
}

/** Restores a versioned document by replaying every stroke, then moving to the saved position.
 * Rejects malformed data, invalid strokes, a different world or an incompatible registry.
 * The caller may list earlier registry revisions whose builders are compatible with this world.
 * An unavailable host becomes an orphan that stays in history and is omitted from projection. */
export function restoreSandboxDocument(
	json: string,
	expectedWorld?: WorldIdentity,
	resolveParams?: ResolveParams,
	compatibleRegistryRevisions: readonly string[] = []
) {
	const { format: version, world, strokes, position } = record(JSON.parse(json) as unknown);
	if (version === 'sandbox/1')
		throw new UnsupportedSandboxVersionError('This save lacks terrain and topology revisions');
	if (version === 'sandbox/2')
		throw new UnsupportedSandboxVersionError(
			'Sandbox/2 uses incompatible placement and movement addresses'
		);
	if (
		version !== format ||
		!Array.isArray(strokes) ||
		!Number.isSafeInteger(position) ||
		typeof position !== 'number' ||
		position < 0 ||
		position > strokes.length
	)
		throw new SandboxDataError('Invalid sandbox format or history position');
	const saved = worldIdentity(world);
	const identity = expectedWorld ? worldIdentity(expectedWorld) : saved;
	if (saved.id !== identity.id)
		throw new SandboxDataError('This document belongs to a different world');
	if (
		saved.registryRevision !== identity.registryRevision &&
		!compatibleRegistryRevisions.includes(saved.registryRevision)
	)
		throw new SandboxDataError('This document uses a different asset registry revision');
	let replaying = true;
	const document = createDocument(identity, resolveParams, () => replaying);
	for (const input of strokes) {
		if (
			!Array.isArray(input) ||
			!document.apply(input.map((operation) => replayEdit(operation, saved))).length
		)
			throw new SandboxDataError('Expected a stroke that changes the document');
	}
	while (document.readHistory().position > position) document.undo();
	replaying = false;
	return document;
}
