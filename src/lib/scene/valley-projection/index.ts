import { PlaceableObject } from '../../core/object';
import type { Valley } from '../../domain/valley';
import { landscape, resolveSurfaces } from '../surface';
import { reachFrame } from './frame';
import { terrainField } from './raster';
import { terrainMeshes } from './meshes';

/** Maximum triangle count including ground, water and the cut earth sides. */
export const valleyTriangleBudget = 30_000;

const stripWidth = 4000;

/** Projects the river from the 8 km measurement window as a 4 km wide strip in the
 * frame of the reach chord. The second argument scales ground, water and skirt elevations
 * (default 14). The terrain uses finer samples near the river and contours read true heights.
 * Returns a detached stage object, the measured reach in true XY meters, and a triangle count.
 * Throws RangeError for a non-positive or non-finite height scale or an over-budget mesh.
 */
export function projectValley(valley: Valley, heightScale = 14) {
	if (!Number.isFinite(heightScale) || heightScale <= 0)
		throw new RangeError('Height scale must be finite and positive');
	const frame = reachFrame(valley);
	const parts = terrainMeshes(frame, stripWidth, heightScale);
	const field = terrainField(frame, stripWidth);
	const triangleCount = parts.reduce((sum, { shape }) => sum + shape.indices.length / 3, 0);
	if (triangleCount > valleyTriangleBudget)
		throw new RangeError('Valley exceeds the triangle budget');
	const object = PlaceableObject.create({
		id: `valley-${valley.seed}`,
		slots: Object.keys(landscape),
		parts,
		footprint: { width: frame.length, depth: stripWidth },
		anchors: []
	});
	return Object.freeze({
		object,
		reach: frame.xy,
		heightScale,
		triangleCount,
		drawables: Object.freeze(
			resolveSurfaces(object, landscape).map((part) =>
				Object.freeze({
					...part,
					heightScale,
					terrainField: part.finish === 'terrain' ? field : undefined,
					boundaryStroke: part.flat === true
				})
			)
		)
	});
}
