import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { levelHeight, type CityVolume } from '../../domain/city-volume';
import type { TerrainGrid } from '../../domain/terrain-grid';
import { edgeKey, mesh, segments } from './mesh';

export function latticeMesh(
	plan: TerrainGrid,
	grid: CityVolume['grid'],
	toLocal: (x: number, y: number) => Vec2
) {
	const geometry = mesh();
	const corners = new Map(
		plan.vertices.map(({ id, position: [x, y, z] }) => [id, [...toLocal(x, y), z] as Vec3])
	);
	const levels = new Map(grid.columns.map(({ planCellId, levels }) => [planCellId, levels]));
	const indices = new Map<string, number>();
	const edges = new Map<string, readonly [number, number]>();
	function vertex(id: string, level: number) {
		const key = `${id}\n${level}`;
		let index = indices.get(key);
		if (index === undefined) {
			const [x, y, z] = required(corners.get(id), 'lattice plan corner');
			index = geometry.positions.length / 3;
			geometry.positions.push(x, y, z + level * levelHeight);
			indices.set(key, index);
		}
		return index;
	}
	function edge(a: number, b: number) {
		edges.set(edgeKey(a, b), [a, b]);
	}
	for (const { id, vertexIds, neighbors } of plan.cells) {
		const count = required(levels.get(id), 'lattice plan column');
		for (let level = 0; level < count; level++) {
			const bottom = vertexIds.map((id) => vertex(id, level));
			const top = vertexIds.map((id) => vertex(id, level + 1));
			for (const [i, a] of bottom.entries()) {
				const j = (i + 1) % bottom.length;
				edge(a, bottom[j]);
				edge(top[i], top[j]);
				edge(a, top[i]);
				const neighbor = neighbors[i];
				// Every internal edge is visible. A single layer of exterior faces keeps the lattice legible.
				if (neighbor === null || level >= required(levels.get(neighbor), 'neighboring column'))
					geometry.indices.push(a, bottom[j], top[j], a, top[j], top[i]);
			}
			if (level === count - 1)
				geometry.indices.push(top[0], top[1], top[2], top[0], top[2], top[3]);
		}
	}
	return { geometry, wires: segments(geometry.positions, edges) };
}
