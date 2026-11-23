import { PlaceableObject } from '../../core/object';
import { peakHeightM, type Valley } from '../../domain/valley';
import { landscape, resolveSurfaces } from '../surface';
import { reachFrame, windowFrame, type ReachFrame, type ValleyWindow } from './frame';
import { terrainField } from './raster';
import { terrainMeshes } from './meshes';

/** Maximum triangle count including ground, water and the cut earth sides. */
export const valleyTriangleBudget = 36_000;

const stripWidth = 4000;

/** Vertical exaggeration of the lowland valley, whose ground spans about 20 m. */
const lowlandScale = 14;
const lowlandReliefM = 20;

/** Pencil contour steps in multiples of the stage's 2 m interval, from fine to coarse. */
const contourSteps = [1, 2.5, 5, 10] as const;
const contoursAcrossRelief = 125;

/** Height scale for a valley: 14 for the lowland, falling with the square root of the nominal
 * relief so that mountains stand taller than hills without towering over the strip. */
export function valleyHeightScale(valley: Valley): number {
	const relief = lowlandReliefM + peakHeightM(valley.parameters.relief);
	return Math.min(
		lowlandScale,
		Math.round(10 * lowlandScale * Math.sqrt(lowlandReliefM / relief)) / 10
	);
}

/** Contour step: the stage draws pencil contours every 2 m of the field's first channel, so the
 * projection stores height divided by this step and contours fall every 2 × step meters. One for
 * the lowland; coarser as the nominal relief grows, so steep flanks keep readable spacing. */
export function valleyContourStep(valley: Valley): number {
	const relief = lowlandReliefM + peakHeightM(valley.parameters.relief);
	return contourSteps.find((step) => step * 2 * contoursAcrossRelief >= relief) ?? 10;
}

/** Projects the river from the 8 km measurement window as a 4 km wide strip in the
 * frame of the reach chord. The second argument scales ground, water and skirt elevations
 * (default valleyHeightScale, 14 for the lowland). The terrain uses finer samples near the river and contours read true heights.
 * Returns a detached stage object, the measured reach in true XY meters, and a triangle count.
 * Throws RangeError for a non-positive or non-finite height scale or an over-budget mesh.
 */
export function projectValley(valley: Valley, heightScale = valleyHeightScale(valley)) {
	return project(valley, reachFrame(valley), stripWidth, heightScale);
}

/** Projects a metric window of the same valley, with local X along its bearing and Z
 * exaggerated by the supplied positive height scale. Returns world XY to local XY
 * conversion for overlays, alongside the detached terrain drawables and triangle count. */
export function projectValleyWindow(valley: Valley, window: ValleyWindow, heightScale: number) {
	if (
		![...window.origin, window.bearing, window.length, window.width].every(Number.isFinite) ||
		window.length <= 0 ||
		window.width <= 0
	)
		throw new RangeError('Expected a finite valley window with positive extents');
	const frame = windowFrame(valley, window);
	return Object.freeze({
		...project(valley, frame, window.width, heightScale),
		toLocal: frame.toLocal
	});
}

function project(valley: Valley, frame: ReachFrame, width: number, heightScale: number) {
	if (!Number.isFinite(heightScale) || heightScale <= 0)
		throw new RangeError('Height scale must be finite and positive');
	const field = terrainField(frame, width, valleyContourStep(valley));
	const parts = terrainMeshes(frame, heightScale, field);
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
		contourStep: valleyContourStep(valley),
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
