import { Vector3 } from 'three/webgpu';
import { bounds, union, type Bounds } from '../../logic/ansicht/geometrie';
import { buildObject } from '../../logic/assets';
import type { Vec3 } from '../../logic/parametrik/types';
import type { World } from '../../logic/sandbox';

/** Camera-space inputs from the same asset parts and placement used for the city centres. */
export function openingLandmarks(world: World) {
	return (world.state.city?.centres ?? []).flatMap(({ landmark }) => {
		const site = world.grid.cellsById.get(landmark.cellId);
		if (!site?.buildable) return [];
		const { parts } = buildObject(landmark.object, landmark.variant, world.seed);
		return [boxCorners(union(parts.map(bounds)), site.center)];
	});
}

/** Eight world-space corners in renderer coordinates. */
export function boxCorners({ min, max }: Bounds, [dx, dy, dz]: Vec3 = [0, 0, 0]) {
	return [min[0], max[0]].flatMap((x) =>
		[min[1], max[1]].flatMap((y) =>
			[min[2], max[2]].map((z) => new Vector3(x + dx, z + dz, -y - dy))
		)
	);
}
