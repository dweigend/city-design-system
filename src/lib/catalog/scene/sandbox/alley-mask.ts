import { MODULE, type TerrainCell, type TerrainGrid } from '../../logic/terrain-grid';
function frontages(next: TerrainGrid, houses: Iterable<string>, radius: number) {
	const occupied = new Uint8Array(next.cells.length);
	for (const id of houses) {
		const cell = next.cellsById.get(id);
		if (!cell) continue;
		markFrontage(next, cell, radius, occupied);
	}
	return occupied;
}

function markFrontage(next: TerrainGrid, cell: TerrainCell, radius: number, occupied: Uint8Array) {
	for (let y = Math.max(0, cell.row - radius); y <= Math.min(next.rows - 1, cell.row + radius); y++)
		for (
			let x = Math.max(0, cell.column - radius);
			x <= Math.min(next.columns - 1, cell.column + radius);
			x++
		)
			occupied[y * next.columns + x] = 1;
}

function builtSides(cell: TerrainCell, houses: ReadonlySet<string>) {
	if (!houses.has(cell.id)) return 0;
	return cell.neighbors.reduce(
		(sides, id, side) => (id && houses.has(id) ? sides | (1 << side) : sides),
		0
	);
}

/** Fill the texture in place so removing the last frontage also erases its stair ink. */
export function writeAlleyMask(
	pixels: Uint8Array,
	next: TerrainGrid,
	anchors: Iterable<string>,
	radius: number
) {
	const houses = new Set(anchors);
	const occupied = frontages(next, houses, radius);
	for (const cell of next.cells) {
		const { square, width, stairAlley } = cell.plan;
		const band = Math.min(255, Math.round((255 * width) / MODULE));
		const channel = (axis: 'along' | 'across') =>
			cell.alley === axis || cell.alley === 'both' || square
				? band
				: Math.round((255 * next.profile.alleyWidth) / MODULE);
		const at = cell.index * 4;
		const active = occupied[cell.index];
		pixels[at] = channel('along');
		pixels[at + 1] = channel('across');
		pixels[at + 2] = (stairAlley ? 128 * active : 0) + 64 * active + builtSides(cell, houses);
		pixels[at + 3] = 255 * cell.plan.extent;
	}
}
