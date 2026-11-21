import type { CellSpace } from '../cell-space';

export type CellFill = Readonly<
	| { kind: 'empty' }
	| { kind: 'bridge'; connectionId: string }
	| { kind: 'house'; houseId: string; roomId: string }
>;

export type Occupancy = ReadonlyMap<string, CellFill>;
export type Reservations = ReadonlyMap<string, string>;
export type CellWrite = Readonly<{ id: string; fill: CellFill }>;

/** Creates a detached total map of empty fills in canonical cell ID order. */
export function createOccupancy(space: CellSpace): Occupancy {
	return new Map(space.cells.map(({ id }) => [id, { kind: 'empty' }]));
}

function validateWrite(current: CellFill, fill: CellFill, id: string) {
	if (current.kind !== 'empty' && fill.kind !== 'empty')
		throw new RangeError('Cell is already occupied: ' + id);
	if (fill.kind === 'bridge' && !fill.connectionId)
		throw new RangeError('Bridge requires a connection ID: ' + id);
	if (fill.kind === 'house' && (!fill.houseId || !fill.roomId))
		throw new RangeError('House requires house and room IDs: ' + id);
}

/**
 * Applies a batch to a total occupancy map in canonical cell ID order.
 * A protected address rejects every write. Clear an occupied cell before assigning a new fill.
 * Throws RangeError on invalid addresses, duplicate targets or conflicts. Inputs stay intact.
 */
export function occupyCells(
	space: CellSpace,
	current: Occupancy,
	reservations: Reservations,
	writes: readonly CellWrite[]
): Occupancy {
	const cellIds = new Set(space.cells.map(({ id }) => id));
	if (cellIds.size !== current.size || [...cellIds].some((id) => !current.has(id)))
		throw new RangeError('Occupancy must cover exactly the space');
	for (const id of [...reservations.keys()].sort()) {
		if (!cellIds.has(id)) throw new RangeError('Unknown reservation: ' + id);
	}
	const pending = new Map<string, CellFill>();
	const orderedWrites = [...writes].sort((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id)));
	for (const { id, fill } of orderedWrites) {
		if (!cellIds.has(id)) throw new RangeError('Unknown cell: ' + id);
		if (pending.has(id)) throw new RangeError('Duplicate cell write: ' + id);
		pending.set(id, fill);
	}
	const next = new Map<string, CellFill>();
	for (const id of [...cellIds].sort()) {
		const before = current.get(id);
		if (!before) throw new RangeError('Missing fill for cell: ' + id);
		const fill = pending.get(id);
		if (fill) {
			if (reservations.has(id)) throw new RangeError('Cell is reserved: ' + id);
			validateWrite(before, fill, id);
		}
		next.set(id, { ...(fill ?? before) });
	}
	return next;
}
