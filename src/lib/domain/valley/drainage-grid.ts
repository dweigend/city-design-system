export type DrainageGrid = { side: number; spacing: number; bed: Int32Array };

export function eachNeighbor(
	side: number,
	index: number,
	visit: (next: number, diagonal: boolean) => void
) {
	const column = index % side;
	const row = (index / side) | 0;
	if (column > 0) visit(index - 1, false);
	if (column + 1 < side) visit(index + 1, false);
	if (row > 0) visit(index - side, false);
	if (row + 1 < side) visit(index + side, false);
	if (column > 0 && row > 0) visit(index - side - 1, true);
	if (column + 1 < side && row + 1 < side) visit(index + side + 1, true);
}
