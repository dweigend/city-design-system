import { isStructural, type Primitive } from '../../logic/parametrik/types';
import { contourWidthMeters } from './contour-width';

export type DrawingDistance = {
	scale: number;
	elevation: number;
	block: boolean;
	minContourPx: number;
};

/** Projected slab height in CSS pixels below which a contour hull hides the top face. */
const THIN_SLAB_PX = 4;
const widths = new Map<number, WeakMap<Primitive, number>>();
const ramps = new WeakMap<Primitive, Primitive>();

function atDistance(part: Primitive): Primitive | undefined {
	if (
		part.cityForm === false ||
		(part.detail && part.role !== 'bestand' && part.kind === 'polyline')
	)
		return;
	if (!part.cityForm) return part;
	const cached = ramps.get(part);
	if (cached) return cached;
	const ramp: Primitive = { ...part, kind: 'membrane', corners: part.cityForm };
	ramps.set(part, ramp);
	return ramp;
}

function widthOf(part: Primitive, elevation: number, cache: WeakMap<Primitive, number>) {
	const cached = cache.get(part);
	if (cached !== undefined) return cached;
	const width = contourWidthMeters(part, elevation);
	cache.set(part, width);
	return width;
}

// CSS pixel comparisons allow one part per million at the active boundary.
// A fresh form keeps equality. An existing stroke crosses the outer 10% band strictly.
function keepContour(width: number, cutoff: number, prior?: boolean) {
	if (cutoff === 0) return true;
	if (prior === false) return width > cutoff * 1.1 * (1 + 1e-6);
	return width >= cutoff * (prior ? 0.9 : 1) * (1 - 1e-6);
}

/** Projects parts into the current detail level and selects their eligible envelope strokes. */
export function distanceDrawing(
	primitives: Primitive[],
	distance: DrawingDistance,
	previous?: ReadonlyMap<string, boolean>
) {
	const { block, elevation, scale, minContourPx } = distance;
	const unoutlined = new Set<Primitive>();
	const contours = new Map<string, boolean>();
	if (!block) return { parts: primitives, unoutlined, contours, details: true };
	const parts: Primitive[] = [];
	const cache = widths.get(elevation) ?? new WeakMap<Primitive, number>();
	widths.set(elevation, cache);
	for (const original of primitives) {
		const part = atDistance(original);
		if (!part) continue;
		parts.push(part);
		if (part.role === 'bestand' || part.material === 'ghost' || isStructural(part)) continue;
		// A slab thinner than its own contour offset would be covered by its shifted hull copies.
		if (part.kind === 'prism' && part.height * scale < THIN_SLAB_PX) {
			contours.set(part.id, false);
			unoutlined.add(part);
			continue;
		}
		const visible = keepContour(
			widthOf(part, elevation, cache) * scale,
			minContourPx,
			previous?.get(part.id)
		);
		contours.set(part.id, visible);
		if (!visible) unoutlined.add(part);
	}
	return { parts, unoutlined, contours, details: false };
}

export type DistanceDrawing = ReturnType<typeof distanceDrawing>;

/** Stable while the camera moves without changing a part's representation or contour eligibility. */
export function sameDrawing(a: DistanceDrawing, b: DistanceDrawing) {
	return (
		a.details === b.details &&
		a.parts.length === b.parts.length &&
		a.parts.every(
			(part, index) => part === b.parts[index] && a.unoutlined.has(part) === b.unoutlined.has(part)
		)
	);
}
