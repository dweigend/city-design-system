/** Module: Records reversible, world-scoped edits to addressed asset placements. */
import type { HostAddress, Placement } from '../../core/asset-registry';
import {
	edit,
	hostKey,
	replace,
	placement,
	readPlacementId,
	readParams,
	record,
	SandboxDataError,
	worldIdentity,
	worldKey,
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
const format = 'sandbox/2';
const noChanges: readonly PlacementChange[] = Object.freeze([]);

/** Keys the single occupancy slot of an exact address by its full world identity. */
export { readPlacementId };

/** Creates an empty document. Each exact host has one slot. A transaction is atomic.
 * A caller may prepare the derived state from the change list before the transaction takes effect.
 * The optional resolver validates and canonicalizes every staged placement and replacement.
 * If preparation throws, the document and its history retain their prior state. */
export function createSandboxDocument(identity: WorldIdentity, resolveParams?: ResolveParams) {
	const world = worldIdentity(identity);
	const placements = new Map<string, SandboxPlacement>();
	const history: Transaction[] = [];
	let position = 0;
	let projection: Prepare | undefined;

	function publish(changes: readonly PlacementChange[], prepare?: Prepare) {
		if (projection && prepare)
			throw new SandboxDataError('This document already owns a projection');
		(projection ?? prepare)?.(changes);
		for (const { id, after } of changes) {
			if (after) placements.set(id, after);
			else placements.delete(id);
		}
		return changes;
	}

	function canonicalParams(assetId: string, host: HostAddress, params: Placement['params']) {
		return resolveParams ? readParams(resolveParams(assetId, host, params)) : params;
	}

	function stage(input: readonly SandboxEdit[]) {
		const edits: SandboxEdit[] = [];
		const staged = new Map<string, SandboxPlacement | undefined>();
		const current = (id: string) => (staged.has(id) ? staged.get(id) : placements.get(id));
		for (const raw of input) {
			const operation = edit(raw);
			if (operation.kind === 'place') {
				const resolved = Object.freeze({
					...operation,
					params: canonicalParams(operation.assetId, operation.host, operation.params)
				});
				const after = placement(world, resolved);
				if (current(after.id))
					throw new OccupiedHostError('Host already occupied: ' + hostKey(after.host));
				edits.push(resolved);
				staged.set(after.id, after);
				continue;
			}
			const { id } = operation;
			const before = current(id);
			if (!before) throw new MissingPlacementError('Missing placement: ' + id);
			const resolved =
				operation.kind === 'replace'
					? Object.freeze({
							...operation,
							params: canonicalParams(before.assetId, before.host, operation.params)
						})
					: operation;
			edits.push(resolved);
			staged.set(id, resolved.kind === 'remove' ? undefined : replace(before, resolved));
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

	return Object.freeze({
		world,
		/** Attaches one derived projection to this document and initializes it from active records.
		 * All later changes prepare that projection before publishing history. */
		attach(prepare: Prepare) {
			if (projection) throw new SandboxDataError('This document already owns a projection');
			prepare(
				[...placements.values()].map((after) => ({ id: after.id, before: undefined, after }))
			);
			projection = prepare;
		},
		/** Reads one active placement for an exact host address. */
		readPlacement: (host: HostAddress) => placements.get(readPlacementId(world, host)),
		/** Lists active placements in stable ID order, independent of how history was traversed. */
		readPlacements: () =>
			Array.from(placements.keys())
				.sort()
				.flatMap((id) => placements.get(id) ?? []),
		/** Counts active placements, total transactions and the number currently applied. */
		readHistory: () => ({ placements: placements.size, strokes: history.length, position }),
		/** Applies one ordered stroke, drops redo on a state change, and returns its net changes. */
		apply(input: readonly SandboxEdit[], prepare?: Prepare) {
			const { edits, changes } = stage(input);
			if (!changes.length) return noChanges;
			publish(changes, prepare);
			history.splice(position, history.length - position, { edits, changes });
			position++;
			return changes;
		},
		/** Extends the last applied transaction with more edits, so a gesture that grows over time
		 * stays one undo step. Publishes and returns only the new net changes. Without an applied
		 * transaction it applies a new one. It drops the redo tail like `apply`. A transaction whose
		 * merged edits cancel out leaves the history. */
		amend(input: readonly SandboxEdit[], prepare?: Prepare) {
			if (position === 0) return this.apply(input, prepare);
			const { edits, changes } = stage(input);
			if (!changes.length) return noChanges;
			publish(changes, prepare);
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
		},
		/** Reverses the last applied transaction. Returns its inverse change list. */
		undo(prepare?: Prepare) {
			if (position === 0) return noChanges;
			const inverse = Object.freeze(
				history[position - 1].changes.map(({ id, before, after }) =>
					Object.freeze({ id, before: after, after: before })
				)
			);
			publish(inverse, prepare);
			position--;
			return inverse;
		},
		/** Reapplies the next transaction and returns its change list. */
		redo(prepare?: Prepare) {
			if (position === history.length) return noChanges;
			const changes = publish(history[position].changes, prepare);
			position++;
			return changes;
		},
		/** Serializes the full edit log including redo and the current position. */
		serialize() {
			return JSON.stringify({
				format,
				world,
				strokes: history.map(({ edits }) => edits),
				position
			});
		}
	});
}

/** Restores a versioned document by replaying every stroke, then moving to the saved position.
 * Rejects malformed data, invalid strokes and optionally a mismatched world before use. */
export function restoreSandboxDocument(
	json: string,
	expectedWorld?: WorldIdentity,
	resolveParams?: ResolveParams
) {
	const { format: version, world, strokes, position } = record(JSON.parse(json) as unknown);
	if (version === 'sandbox/1')
		throw new SandboxDataError('This save lacks terrain and topology revisions');
	if (
		version !== format ||
		!Array.isArray(strokes) ||
		!Number.isSafeInteger(position) ||
		typeof position !== 'number' ||
		position < 0 ||
		position > strokes.length
	)
		throw new SandboxDataError('Invalid sandbox format or history position');
	const identity = worldIdentity(world);
	if (expectedWorld && worldKey(identity) !== worldKey(worldIdentity(expectedWorld)))
		throw new SandboxDataError('This document belongs to a different world');
	const document = createSandboxDocument(identity, resolveParams);
	for (const input of strokes) {
		if (!Array.isArray(input) || !document.apply(input).length)
			throw new SandboxDataError('Expected a stroke that changes the document');
	}
	while (document.readHistory().position > position) document.undo();
	return document;
}
