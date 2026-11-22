import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { TerrainGrid } from '../../domain/terrain-grid';

// The fixed terrace core anchors growth. Reachability can expand as cells are added.
export function terraceGrid(grid: TerrainGrid, origin: Vec2, radius: number): TerrainGrid {
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	const cells = new Map(grid.cells.map((cell) => [cell.id, cell]));
	const queue = grid.cells.filter(({ vertexIds }) => {
		const [x, y] = vertexIds.reduce(
			([x, y], id) => {
				const [u, v] = required(vertices.get(id), 'city vertex');
				return [x + (u - origin[0]) / vertexIds.length, y + (v - origin[1]) / vertexIds.length];
			},
			[0, 0]
		);
		return Math.hypot(x, y) <= radius;
	});
	const reached = new Set(queue.map(({ id }) => id));
	for (const cell of queue) {
		for (const neighbor of cell.neighbors) {
			if (neighbor === null || reached.has(neighbor)) continue;
			reached.add(neighbor);
			queue.push(required(cells.get(neighbor), 'city neighbor'));
		}
	}
	const kept = grid.cells.filter(({ id }) => reached.has(id));
	const vertexIds = new Set(kept.flatMap((cell) => cell.vertexIds));
	const boundary = new Set(
		kept.flatMap((cell) =>
			cell.vertexIds.flatMap((from, i) =>
				cell.neighbors[i] === null
					? [`${from}\n${cell.vertexIds[(i + 1) % cell.vertexIds.length]}`]
					: []
			)
		)
	);
	return Object.freeze({
		cells: Object.freeze(kept),
		vertices: Object.freeze(grid.vertices.filter(({ id }) => vertexIds.has(id))),
		boundary: Object.freeze(grid.boundary.filter(([from, to]) => boundary.has(`${from}\n${to}`)))
	});
}
