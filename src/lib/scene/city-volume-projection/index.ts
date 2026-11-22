import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { PlaceableObject, type Footprint, type Shape } from '../../core/object';
import type { CityVolume, VolumeCell } from '../../domain/city-volume';
import {
	planningHeights,
	planningVolume,
	resolveSurfaces,
	type SurfaceAssignment
} from '../surface';

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
		const wallHeight = neighbor === null ? height : -neighbor.heightDifference;
		const drawsRim = !neighbor || wallHeight !== 0 || id < neighbor.id;
		const end = a + side.length;
		if (wallHeight > 0) {
			const corners = neighbor ? [a, end % count] : [a];
			for (const corner of corners) {
				const [x, y, z] = roof[corner];
				segments.push(x, y, z - wallHeight, x, y, z);
			}
		}
		for (; a < end; a++) {
			const b = (a + 1) % count;
			indices.push(2 * count, a + count, b + count);
			if (drawsRim) segments.push(...roof[a], ...roof[b]);
			if (!neighbor) segments.push(...ring[a], ...ring[b]);
			if (wallHeight <= 0) continue;
			const bottom = positions.length / 3;
			for (const [x, y, z] of [roof[a], roof[b]]) positions.push(x, y, z - wallHeight);
			indices.push(bottom, bottom + 1, b + count, bottom, b + count, a + count);
		}
	}
	return { shape: { kind: 'mesh', positions, indices }, strokeSegments: Object.freeze(segments) };
}

/** Projects one indexed hull mesh per cell in local stage meters. Rings are the terrain
 * projection's ordered sides. Their samples support the walls and a translated canopy,
 * drawing only the exterior and exposed height differences. The terrain itself closes the footprint underneath. */
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
	function drawables(assignment: SurfaceAssignment) {
		return resolveSurfaces(object, assignment).map((part, index) => ({
			...part,
			strokeSegments: geometry[index].strokeSegments
		}));
	}
	return {
		object,
		drawables: drawables(planningVolume),
		heightDrawables: drawables(planningHeights)
	};
}
