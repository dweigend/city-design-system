import { isStructural, type Primitive } from '../../logic/parametrik/types';
import { contourWidthMeters } from './contour-width';

export type DrawingDistance = {
	scale: number;
	plan: boolean;
	block: boolean;
	minContourPx: number;
};

const widths = [new WeakMap<Primitive, number>(), new WeakMap<Primitive, number>()] as const;
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

function widthOf(part: Primitive, plan: boolean) {
	const cache = widths[plan ? 1 : 0];
	const cached = cache.get(part);
	if (cached !== undefined) return cached;
	const width = contourWidthMeters(part, plan);
	cache.set(part, width);
	return width;
}

/** Projects parts into the current detail level and selects their eligible envelope strokes. */
export function distanceDrawing(primitives: Primitive[], distance: DrawingDistance) {
	const { block, plan, scale, minContourPx } = distance;
	const unoutlined = new Set<Primitive>();
	if (!block) return { parts: primitives, unoutlined, details: true };
	const parts: Primitive[] = [];
	for (const original of primitives) {
		const part = atDistance(original);
		if (!part) continue;
		parts.push(part);
		if (
			part.role !== 'bestand' &&
			part.material !== 'ghost' &&
			!isStructural(part) &&
			widthOf(part, plan) * scale < minContourPx
		)
			unoutlined.add(part);
	}
	return { parts, unoutlined, details: false };
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
