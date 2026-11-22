import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { PlaceableObject, type Footprint, type Shape } from '../../core/object';
import type { CityVolume, VolumeCell, VolumeEdge } from '../../domain/city-volume';
import { planningVolume, resolveSurfaces } from '../surface';

// One wall per shared edge. At equal height the lower ID owns it.
function ownsWall(id: string, neighbor: VolumeEdge | null): boolean {
	return (
		neighbor === null ||
		neighbor.heightDifference < 0 ||
		(neighbor.heightDifference === 0 && id < neighbor.id)
	);
}

function cellGeometry(
	{ id, height, edges }: VolumeCell,
	sides: readonly (readonly Vec3[])[]
): { shape: Shape; strokeSegments: readonly number[] } {
	const ring = sides.flat();
	const count = ring.length;
	const positions = ring.flatMap((point) => [...point]);
	const roof = ring.map(([x, y, z]): Vec3 => [x, y, z + height]);
	for (const point of roof) positions.push(...point);
	const middle = ring.reduce(
		([x, y, z], [u, v, w]) => [x + u / count, y + v / count, z + w / count],
		[0, 0, height]
	);
	positions.push(...middle);
	const indices: number[] = [];
	const segments: number[] = [];
	let a = 0;
	for (const [edge, side] of sides.entries()) {
		const neighbor = edges[edge];
		const hasWall = ownsWall(id, neighbor);
		segments.push(...ring[a], ...roof[a]);
		const drawsRim = hasWall || neighbor?.heightDifference !== 0;
		const end = a + side.length;
		for (; a < end; a++) {
			const b = (a + 1) % count;
			indices.push(2 * count, a + count, b + count);
			if (hasWall) indices.push(a, b, b + count, a, b + count, a + count);
			if (drawsRim) segments.push(...roof[a], ...roof[b]);
		}
	}
	return { shape: { kind: 'mesh', positions, indices }, strokeSegments: Object.freeze(segments) };
}

/** Projects one indexed hull mesh per cell in local stage meters. Rings are the terrain
 * projection's ordered sides. Their samples support the walls and a translated canopy,
 * with shared walls emitted once. The terrain itself closes the footprint underneath. */
export function projectCityVolume(
	volume: CityVolume,
	edgesByCellId: ReadonlyMap<string, readonly (readonly Vec3[])[]>,
	footprint: Footprint
) {
	const geometry = volume.cells.map((cell) =>
		cellGeometry(cell, required(edgesByCellId.get(cell.id), 'draped cell edges'))
	);
	const object = PlaceableObject.create({
		id: 'city-volume',
		slots: ['volume'],
		footprint,
		anchors: [],
		parts: volume.cells.map(({ id }, index) => ({
			id,
			slot: 'volume',
			shape: geometry[index].shape
		}))
	});
	return {
		object,
		drawables: resolveSurfaces(object, planningVolume).map((part, index) => ({
			...part,
			strokeSegments: geometry[index].strokeSegments
		}))
	};
}
