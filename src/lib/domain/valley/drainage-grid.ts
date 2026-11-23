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

// Exact arithmetic: each vertex gets one third of each incident half-cell triangle.
export function vertexArea(side: number, spacing: number, index: number) {
	const x = index % side;
	const y = (index / side) | 0;
	const boundaryX = x === 0 || x === side - 1;
	const boundaryY = y === 0 || y === side - 1;
	const triangles = boundaryX && boundaryY ? 1 + Number(x === y) : boundaryX || boundaryY ? 3 : 6;
	return (spacing * spacing * triangles) / 6;
}
