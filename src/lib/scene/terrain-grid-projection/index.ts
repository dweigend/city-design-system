import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { PlaceableObject, type Shape } from '../../core/object';
import type { TerrainGrid } from '../../domain/terrain-grid';
import { resolveSurfaces } from '../surface';
import { drape } from './drape';

/** Prepares the terrain's triangle index once. The returned function projects a grid as one
 * line-finished mesh batch, with a private ring of indices per cell. It splits edges at terrain
 * triangle crossings and follows the mesh's exaggerated Z. The stage applies the depth bias.
 * Supplies regular and faint strokes on the same mesh. Throws RangeError for an edge outside the mesh. Grid data stays in true meters. */
export function terrainGridProjection(
	ground: Extract<Shape, { kind: 'mesh' }>,
	toLocal: (x: number, y: number) => Vec2,
	footprint: Readonly<{ width: number; depth: number }>
) {
	const project = drape(ground);
	return (grid: TerrainGrid) => projectGrid(grid, project, toLocal, footprint);
}

function projectGrid(
	grid: TerrainGrid,
	project: ReturnType<typeof drape>,
	toLocal: (x: number, y: number) => Vec2,
	footprint: Readonly<{ width: number; depth: number }>
) {
	const positions: number[] = [];
	const indices: number[] = [];
	const vertex = new Map(grid.vertices.map(({ id, position: [x, y] }) => [id, toLocal(x, y)]));
	const edges = new Map<string, Vec3[]>();
	function edge(from: string, to: string) {
		const forward = from < to;
		const key = JSON.stringify(forward ? [from, to] : [to, from]);
		let points = edges.get(key);
		if (!points) {
			const a = required(vertex.get(forward ? from : to), 'edge start');
			const b = required(vertex.get(forward ? to : from), 'edge end');
			points = project(a, b);
			edges.set(key, points);
		}
		return (forward ? points : [...points].reverse()).slice(0, -1);
	}
	for (const { vertexIds } of grid.cells) {
		const sides = vertexIds.map((from, i) => edge(from, vertexIds[(i + 1) % vertexIds.length]));
		const ring = sides.flat();
		const center = positions.length / 3;
		const middle = vertexIds.reduce(
			([x, y], id) => {
				const [u, v] = required(vertex.get(id), 'cell corner');
				return [x + u / vertexIds.length, y + v / vertexIds.length];
			},
			[0, 0]
		);
		// The fill is invisible. The fan supplies connected topology even at collinear terrain cuts.
		positions.push(...middle, ring[0][2]);
		for (const [i, point] of ring.entries()) {
			positions.push(...point);
			indices.push(center, center + 1 + i, center + 1 + ((i + 1) % ring.length));
		}
	}
	const object = PlaceableObject.create({
		id: 'terrain-grid',
		slots: ['cell'],
		footprint,
		anchors: [],
		parts: indices.length
			? [{ id: 'terrain-grid', slot: 'cell', shape: { kind: 'mesh', positions, indices } }]
			: []
	});
	const drawables = resolveSurfaces(object, { cell: { color: '--ink-2', finish: 'line' } });
	const traces = resolveSurfaces(object, { cell: { color: '--plan-trace', finish: 'line' } });
	return Object.freeze({
		object,
		traces: Object.freeze(traces.map((part) => Object.freeze(part))),
		drawables: Object.freeze(drawables.map((part) => Object.freeze(part)))
	});
}
