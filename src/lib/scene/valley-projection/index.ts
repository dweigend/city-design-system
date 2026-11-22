import { PlaceableObject } from '../../core/object';
import type { Valley } from '../../domain/valley';
import { landscape, resolveSurfaces } from '../surface';
import { terrainMeshes } from './meshes';

/** Maximum triangle count for the 25 m presentation grid, including the water */
export const valleyTriangleBudget = 30_000;

/** Projects the entire terrain grid and water together as one metric object, centered at XY zero.
 * Resamples at 25 m by striding over the 12.5 m grid. Water follows the same triangle cuts.
 * Returns detached object parts, drawables and the exact triangle count.
 */
export function projectValley(valley: Valley) {
	const { grid, seed } = valley;
	const extent = (grid.side - 1) * grid.cellSize;
	const parts = terrainMeshes(grid);
	const triangleCount = parts.reduce((sum, { shape }) => sum + shape.indices.length / 3, 0);
	if (triangleCount > valleyTriangleBudget)
		throw new RangeError('Valley exceeds the triangle budget');
	const object = PlaceableObject.create({
		id: `valley-${seed}`,
		slots: Object.keys(landscape),
		parts,
		footprint: { width: extent, depth: extent },
		anchors: []
	});
	return Object.freeze({
		object,
		triangleCount,
		drawables: Object.freeze(resolveSurfaces(object, landscape))
	});
}
