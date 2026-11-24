import type { KeyedRing } from './split';

/** What lies across one side of a fine cell: another cell, or the parcel edge with its identity
 * (`JSON [from corner key, to corner key]`) and whether it faces the frontage. `court: true` marks
 * a parcel edge that opens onto a shared court; the field is absent otherwise. */
export type CellSide = Readonly<{
	neighbour: string | null;
	edge: string | null;
	frontage: boolean;
	court?: true;
}>;

const sideKey = (ring: KeyedRing, i: number) =>
	JSON.stringify([ring.keys[i], ring.keys[(i + 1) % ring.keys.length]].sort());

/** Resolves every side to the cell naming the same side or the parcel edge it was split from.
 * Sides are matched by their symbolic point keys, never by coordinates. A side matching neither,
 * or more than one partner, throws: the split never leaves a hanging corner. */
export function resolveSides(
	cells: readonly KeyedRing[],
	frontage: ReadonlySet<string>,
	court: ReadonlySet<string> = new Set()
): readonly (readonly CellSide[])[] {
	const owners = new Map<string, string[]>();
	for (const cell of cells)
		cell.keys.forEach((_, i) =>
			owners.set(sideKey(cell, i), [...(owners.get(sideKey(cell, i)) ?? []), cell.id])
		);
	return cells.map((cell) =>
		cell.keys.map((_, i): CellSide => {
			const others = (owners.get(sideKey(cell, i)) ?? []).filter((id) => id !== cell.id);
			if (others.length > 1) throw new RangeError(`Cell side ${cell.id}#${i} has several partners`);
			const edge = cell.edges[i];
			if (others.length) return { neighbour: others[0], edge: null, frontage: false };
			if (edge === null) throw new RangeError(`Cell side ${cell.id}#${i} has no partner`);
			const side = { neighbour: null, edge, frontage: frontage.has(edge) };
			return court.has(edge) ? { ...side, court: true } : side;
		})
	);
}
