import { required } from '../../core/invariant';
import { PlaceableObject } from '../../core/object';
import type { Valley } from '../../domain/valley';
import { terrainGridProjection } from '../terrain-grid-projection';
import { landscape, resolveSurfaces } from '../surface';
import { reachFrame, windowFrame, type ReachFrame, type ValleyWindow } from './frame';
import { terrainField } from './raster';
import { terrainMeshes } from './meshes';
import { waterSurface } from './water';

/** Maximum triangle count including ground, water and the cut earth sides. */
export const valleyTriangleBudget = 36_000;

const stripWidth = 4000;

const lowlandScale = 14;
const contourSteps = [1, 2.5, 5, 10] as const;

function visualScale(relief: number) {
	return Math.min(lowlandScale, Math.round(10 * lowlandScale * Math.sqrt(38 / relief)) / 10);
}

function contourScale(relief: number) {
	return contourSteps.find((step) => step * 2 * 75 >= relief) ?? 10;
}

/** Projects the river from the 8 km measurement window as a 4 km wide strip in the
 * frame of the reach chord. The second argument scales ground, water and skirt elevations
 * (14 for lowland, less as visible relief grows). The terrain uses finer samples near the river and contours read true heights.
 * Returns a detached stage object, the measured reach in true XY meters, and a triangle count.
 * Throws RangeError for a non-positive or non-finite height scale or an over-budget mesh.
 */
export function projectValley(valley: Valley, heightScale?: number) {
	return project(valley, reachFrame(valley, stripWidth), stripWidth, heightScale);
}

/** Projects a metric window of the same valley, with local X along its bearing and Z
 * exaggerated by the supplied positive height scale. Returns world XY to local XY
 * conversion for overlays, a plan draping adapter, the detached drawables and triangle count. */
export function projectValleyWindow(valley: Valley, window: ValleyWindow, heightScale: number) {
	if (
		![...window.origin, window.bearing, window.length, window.width].every(Number.isFinite) ||
		window.length <= 0 ||
		window.width <= 0
	)
		throw new RangeError('Expected a finite valley window with positive extents');
	const frame = windowFrame(valley, window);
	const result = project(valley, frame, window.width, heightScale);
	const ground = required(
		result.object.parts.find(({ slot }) => slot === 'ground'),
		'valley ground'
	).shape;
	if (ground.kind !== 'mesh') throw new Error('Expected a valley ground mesh');
	return Object.freeze({
		...result,
		footprint: result.object.footprint,
		toLocal: frame.toLocal,
		projectPlan: terrainGridProjection(ground, frame.toLocal, result.object.footprint)
	});
}

function project(valley: Valley, frame: ReachFrame, width: number, scale?: number) {
	const { field, relief } = terrainField(frame, width);
	const autoHeightScale = visualScale(relief);
	const heightScale = scale ?? autoHeightScale;
	if (!Number.isFinite(heightScale) || heightScale <= 0)
		throw new RangeError('Height scale must be finite and positive');
	const contourStep = contourScale(relief);
	for (let i = 0; i < field.samples.length; i += 4) field.samples[i] /= contourStep;
	const water = waterSurface(valley, frame, width, heightScale);
	const parts = terrainMeshes(frame, heightScale, field, water, valleyTriangleBudget);
	const triangleCount = parts.reduce((sum, { shape }) => sum + shape.indices.length / 3, 0);
	if (triangleCount > valleyTriangleBudget)
		throw new RangeError('Valley exceeds the triangle budget');
	const object = PlaceableObject.create({
		id: `valley-${valley.seed}`,
		slots: Object.keys(landscape),
		parts,
		footprint: { width: frame.length, depth: width },
		anchors: []
	});
	return Object.freeze({
		object,
		reach: frame.xy,
		heightScale,
		autoHeightScale,
		contourStep,
		triangleCount,
		drawables: Object.freeze(
			resolveSurfaces(object, landscape).map((part) =>
				Object.freeze({
					...part,
					heightScale,
					terrainField: part.finish === 'terrain' ? field : undefined,
					boundaryStroke: part.flat === true && part.id !== 'river'
				})
			)
		)
	});
}
