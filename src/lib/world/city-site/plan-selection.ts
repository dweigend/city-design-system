import { convexHull, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { TerrainGrid } from '../../domain/terrain-grid';

function contains(hull: readonly Vec2[], [x, y]: Vec2) {
	return hull.every(([a, b], i) => {
		const [u, v] = hull[(i + 1) % hull.length];
		return (u - a) * (y - b) - (v - b) * (x - a) >= 0;
	});
}

export function preparePlanSelection(plan: TerrainGrid) {
	const vertices = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	const wet = plan.cells
		.filter(({ groundKind }) => groundKind !== 'dry')
		.map(({ id, vertexIds, neighbors }) => ({
			id,
			neighbors,
			center: vertexIds.reduce<Vec2>(
				([x, y], vertex) => {
					const [a, b] = required(vertices.get(vertex), 'water cell vertex');
					return [x + a / vertexIds.length, y + b / vertexIds.length];
				},
				/* Exact arithmetic: initial sum of XY coordinates. */ [0, 0]
			)
		}));
	return (built: TerrainGrid) => {
		const dry = new Set(built.cells.map(({ id }) => id));
		const selected = new Set(dry);
		if (!dry.size) return selected;
		const hull = convexHull(built.vertices.map(({ position: [x, y] }) => [x, y]));
		for (const { id, center, neighbors } of wet) {
			if (
				neighbors.some((neighbor) => neighbor !== null && dry.has(neighbor)) ||
				contains(hull, center)
			)
				selected.add(id);
		}
		return selected;
	};
}
