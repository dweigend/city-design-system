import type { Vec2, Vec3 } from '../../core/geometry';
import { blockInputs, defineParams, resolveParams } from '../../core/params';
import type { TerrainGrid, TerrainGridVertex } from '../terrain-grid';
import { heightField } from './height';

/** A full storey is three meters. Caps below one storey retain the specified height. */
export const storeyHeight = 3;

/** Shared height cap in meters and unitless differentiation with city preview defaults. */
export const cityVolumeParams = defineParams({
	height: { ...blockInputs.height, default: 30 },
	complexity: { ...blockInputs.complexity, default: 0.85 }
});

/** A signed change in height above shared ground, from this cell to its neighbor, in meters. */
export type VolumeEdge = Readonly<{ id: string; heightDifference: number }>;

/** One plan cell in meters. Raise each CCW base point by height for the canopy; edge i
 * leads from base point i to its successor, with null at the outside of the plan. */
export type VolumeCell = Readonly<{
	id: string;
	base: readonly Vec3[];
	height: number;
	edges: readonly (VolumeEdge | null)[];
}>;

/** Detached, deeply frozen volume cells in plan order. */
export type CityVolume = Readonly<{ cells: readonly VolumeCell[] }>;

/** The datum and its bearing (radians) stay fixed as the plan grows. TerrainGrid's addressed
 * vertices and ordered neighbor slots give the volume the same cell IDs and shared edges. */
export type CityVolumeOptions = Readonly<{
	plan: Pick<TerrainGrid, 'cells' | 'vertices'>;
	datum: Readonly<{ origin: Vec2; bearing: number }>;
	seed: number;
	parameters?: Readonly<{ height?: number; complexity?: number }>;
}>;

function uniqueById<T extends { id: string }>(items: readonly T[]) {
	const indexed = new Map<string, T>();
	for (const item of items) {
		if (!item.id || indexed.has(item.id)) throw new RangeError('Missing or duplicate plan id');
		indexed.set(item.id, item);
	}
	return indexed;
}

function baseRing(vertices: ReadonlyMap<string, TerrainGridVertex>, ids: readonly string[]) {
	const base = ids.map((id) => {
		const position = vertices.get(id)?.position;
		if (position?.length !== 3 || !position.every(Number.isFinite))
			throw new RangeError('Expected a finite plan vertex');
		return Object.freeze([...position] as const);
	});
	if (
		base.length !== 4 ||
		new Set(ids).size !== 4 ||
		base.some(([ax, ay], i) => {
			const [bx, by] = base[(i + 1) % 4];
			const [cx, cy] = base[(i + 2) % 4];
			return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) <= 0;
		})
	)
		throw new RangeError('Expected a convex counterclockwise plan cell');
	return Object.freeze(base);
}

function create({
	plan,
	datum: { origin, bearing },
	seed,
	parameters
}: CityVolumeOptions): CityVolume {
	const { height, complexity } = resolveParams(cityVolumeParams, parameters);
	if (origin.length !== 2 || ![...origin, bearing].every(Number.isFinite))
		throw new RangeError('Expected a finite plan datum');
	const field = heightField(seed, origin, bearing);
	const vertices = uniqueById(plan.vertices);
	uniqueById(plan.cells);
	const storeys = Math.max(1, Math.floor(height / storeyHeight));
	const cells = plan.cells.map(({ id, vertexIds, neighbors }) => {
		const base = baseRing(vertices, vertexIds);
		const center = base.reduce<Vec2>(([x, y], [u, v]) => [x + u / 4, y + v / 4], [0, 0]);
		const fraction = 1 - complexity * 0.8 * (1 - field(center));
		const cellHeight = Math.min(height, Math.max(1, Math.round(storeys * fraction)) * storeyHeight);
		return { id, base, height: cellHeight, vertexIds, neighbors };
	});
	const cellsById = new Map(cells.map((cell) => [cell.id, cell]));
	return Object.freeze({
		cells: Object.freeze(
			cells.map(({ id, base, height, neighbors, vertexIds }) => {
				if (neighbors.length !== vertexIds.length)
					throw new RangeError('Expected one neighbor slot per plan edge');
				const edges = neighbors.map((neighborId, edge) => {
					if (neighborId === null) return null;
					const neighbor = cellsById.get(neighborId);
					const opposite = neighbor?.vertexIds.indexOf(vertexIds[(edge + 1) % 4]) ?? -1;
					if (
						!neighbor ||
						neighbor.id === id ||
						opposite < 0 ||
						neighbor.vertexIds[(opposite + 1) % 4] !== vertexIds[edge] ||
						neighbor.neighbors[opposite] !== id
					)
						throw new RangeError('Expected reciprocal neighbors across the same edge');
					return Object.freeze({ id: neighborId, heightDifference: neighbor.height - height });
				});
				return Object.freeze({ id, base, height, edges: Object.freeze(edges) });
			})
		)
	});
}

/** Creates a volume without changing the input. Two keyed centers form smooth radial hills;
 * their maximum blends with the uniform height as complexity increases. The same cell ID
 * and stable outline have the same height on a larger crop with the same seed and datum.
 * Parameters clamp and snap through the shared schema. Invalid seeds, geometry or topology throw
 * RangeError. Parameter type errors throw TypeError. An empty plan produces no cells. */
export const CityVolume = Object.freeze({ create });
