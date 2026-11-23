import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { TerrainGrid } from '../../domain/terrain-grid';

// Keep the component anchored at the datum. A larger crop can reach new cells on this
// terrace, but a second patch on the opposite bank cannot start its own component.
export function terraceGrid(grid: TerrainGrid, origin: Vec2): TerrainGrid {
	if (!grid.cells.length) return grid;
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	const cells = new Map(grid.cells.map((cell) => [cell.id, cell]));
	let anchor = grid.cells[0];
	let closest = Infinity;
	for (const cell of grid.cells) {
		const { vertexIds } = cell;
		const [x, y] = vertexIds.reduce(
			([x, y], id) => {
				const [u, v] = required(vertices.get(id), 'city vertex');
				return [x + (u - origin[0]) / vertexIds.length, y + (v - origin[1]) / vertexIds.length];
			},
			[0, 0]
		);
		const distance = Math.hypot(x, y);
		if (distance < closest) {
			closest = distance;
			anchor = cell;
		}
	}
	const queue = [anchor];
	const reached = new Set([anchor.id]);
	for (const cell of queue) {
		for (const neighbor of cell.neighbors) {
			if (neighbor === null || reached.has(neighbor)) continue;
			reached.add(neighbor);
			queue.push(required(cells.get(neighbor), 'city neighbor'));
		}
	}
	const kept = grid.cells.filter(({ id }) => reached.has(id));
	const vertexIds = new Set(kept.flatMap((cell) => cell.vertexIds));
	return Object.freeze({
		cells: Object.freeze(kept),
		vertices: Object.freeze(grid.vertices.filter(({ id }) => vertexIds.has(id))),
		boundary: Object.freeze(
			grid.boundary.filter(([from, to]) => vertexIds.has(from) && vertexIds.has(to))
		)
	});
}
