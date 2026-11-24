import type { KeyedRing } from './split';

/** What lies across one side of a fine cell: another cell, or the parcel edge with its identity
 * (`JSON [from corner key, to corner key]`) and whether it faces the frontage. */
export type CellSide = Readonly<{
	neighbour: string | null;
	edge: string | null;
	frontage: boolean;
}>;

const sideKey = (ring: KeyedRing, i: number) =>
	[ring.keys[i], ring.keys[(i + 1) % ring.keys.length]].sort().join('|');

/** Resolves every side to the cell naming the same side or the parcel edge it was split from.
 * Sides are matched by their symbolic point keys, never by coordinates. A side matching neither,
 * or more than one partner, throws: the split never leaves a hanging corner. */
export function resolveSides(
	cells: readonly KeyedRing[],
	frontage: ReadonlySet<string>
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
			return { neighbour: null, edge, frontage: frontage.has(edge) };
		})
	);
}
