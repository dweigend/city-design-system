import { MODULE, type TerrainCell, type TerrainGrid } from '../../logic/terrain-grid';
function frontages(next: TerrainGrid, houses: Iterable<string>, radius: number) {
	const occupied = new Set<number>();
	for (const id of houses) {
		const cell = next.cellsById.get(id);
		if (!cell) continue;
		markFrontage(next, cell, radius, occupied);
	}
	return occupied;
}

function markFrontage(next: TerrainGrid, cell: TerrainCell, radius: number, occupied: Set<number>) {
	for (let y = Math.max(0, cell.row - radius); y <= Math.min(next.rows - 1, cell.row + radius); y++)
		for (
			let x = Math.max(0, cell.column - radius);
			x <= Math.min(next.columns - 1, cell.column + radius);
			x++
		)
			occupied.add(y * next.columns + x);
}

/** Fill the texture in place so removing the last frontage also erases its stair ink. */
export function writeAlleyMask(
	pixels: Uint8Array,
	next: TerrainGrid,
	anchors: Iterable<string>,
	radius: number
) {
	const occupied = frontages(next, anchors, radius);
	for (const cell of next.cells) {
		const { square, width, stairAlley } = cell.plan;
		const band = Math.min(255, Math.round((255 * width) / MODULE));
		const channel = (axis: 'along' | 'across') =>
			cell.alley === axis || cell.alley === 'both' || square
				? band
				: Math.round((255 * next.profile.alleyWidth) / MODULE);
		pixels.set(
			[
				channel('along'),
				channel('across'),
				(stairAlley && occupied.has(cell.index) ? 128 : 0) + (occupied.has(cell.index) ? 64 : 0),
				255 * cell.plan.extent
			],
			cell.index * 4
		);
	}
}
