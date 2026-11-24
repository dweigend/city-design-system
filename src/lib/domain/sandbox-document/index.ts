/** Module: Records reversible, world-scoped edits to addressed asset placements. */
import type { HostAddress } from '../../core/asset-registry';
import {
	edit,
	hostKey,
	replace,
	placement,
	readPlacementId,
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
const format = 'sandbox/1';
const noChanges: readonly PlacementChange[] = Object.freeze([]);

/** Keys the single occupancy slot of an exact address by its full world identity. */
export { readPlacementId };

/** Creates an empty document. Each exact host has one slot. A transaction is atomic.
 * A caller may prepare the derived state from the change list before the transaction takes effect.
 * If preparation throws, the document and its history retain their prior state. */
export function createSandboxDocument(identity: WorldIdentity) {
	const world = worldIdentity(identity);
	const placements = new Map<string, SandboxPlacement>();
	const history: Transaction[] = [];
	let position = 0;

	function publish(changes: readonly PlacementChange[], prepare?: Prepare) {
		prepare?.(changes);
		for (const { id, after } of changes) {
			if (after) placements.set(id, after);
			else placements.delete(id);
		}
		return changes;
	}

	function stage(edits: readonly SandboxEdit[]) {
		const staged = new Map<string, SandboxPlacement | undefined>();
		const current = (id: string) => (staged.has(id) ? staged.get(id) : placements.get(id));
		for (const operation of edits) {
			if (operation.kind === 'place') {
				const after = placement(world, operation);
				if (current(after.id))
					throw new OccupiedHostError('Host already occupied: ' + hostKey(after.host));
				staged.set(after.id, after);
				continue;
			}
			const { id } = operation;
			const before = current(id);
			if (!before) throw new MissingPlacementError('Missing placement: ' + id);
			staged.set(id, operation.kind === 'remove' ? undefined : replace(before, operation));
		}
		return Object.freeze(
			Array.from(staged, ([id, after]) =>
				Object.freeze({
					id,
					before: placements.get(id),
					after
				})
			).filter(({ before, after }) => before !== after)
		);
	}

	return Object.freeze({
		world,
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
			const edits = Object.freeze(input.map(edit));
			const changes = stage(edits);
			if (!changes.length) return noChanges;
			publish(changes, prepare);
			history.splice(position, history.length - position, { edits, changes });
			position++;
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
	validate?: Prepare
) {
	const { format: version, world, strokes, position } = record(JSON.parse(json) as unknown);
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
	const document = createSandboxDocument(identity);
	for (const input of strokes) {
		if (!Array.isArray(input) || !document.apply(input, validate).length)
			throw new SandboxDataError('Expected a stroke that changes the document');
	}
	while (document.readHistory().position > position) document.undo();
	return document;
}
