import { clipSegment, onBorder } from './clip-segment';
import { distance, pointAt, polylineLength } from './polyline';

/** Validates and measures the length of an interleaved XY polyline in meters. */
export { polylineLength } from './polyline';
/** Reads XY points and computes their Euclidean distance in the input unit. */
export { distance, pointAt, type Point } from './polyline';

/** One detached clipped polyline in meters and its border contact count. */
export type ClippedReach = Readonly<{
	xy: Float64Array;
	borderHits: number;
}>;

type Reach = { xy: number[]; length: number; borderHits: number };

function longestReach(xy: ArrayLike<number>, half: number): Reach {
	let longest: Reach = { xy: [], length: 0, borderHits: 0 };
	let current = longest;

	for (let index = 2; index < xy.length; index += 2) {
		const segment = clipSegment(pointAt(xy, index - 2), pointAt(xy, index), half);
		if (!segment) {
			current = { xy: [], length: 0, borderHits: 0 };
			continue;
		}
		const { start, end, startsAtVertex, endsAtVertex, overlapsBorder } = segment;
		if (!startsAtVertex || current.xy.length === 0) {
			current = { xy: [start.x, start.y], length: 0, borderHits: Number(onBorder(start, half)) };
		}
		current.xy.push(end.x, end.y);
		current.length += distance(start, end);
		current.borderHits += overlapsBorder ? Infinity : Number(onBorder(end, half));
		if (current.length > longest.length) longest = current;
		if (!endsAtVertex) current = { xy: [], length: 0, borderHits: 0 };
	}
	return longest;
}

/**
 * Clips a finite interleaved XY polyline (meters) to the closed square of side `size`
 * centered at the origin. Returns the longest positive-length reach (first on ties),
 * in input order with a detached buffer, or null if none. Counts border contacts on
 * that reach, including tangencies, once per vertex. A border overlap yields Infinity.
 * Throws RangeError for an invalid window or polyline. Leaves the input untouched.
 */
export function clipPolylineToSquare(xy: ArrayLike<number>, size: number): ClippedReach | null {
	const half = size / 2;
	if (!Number.isFinite(size) || half <= 0) throw new RangeError('invalid-window');
	polylineLength(xy);
	const reach = longestReach(xy, half);
	if (reach.length === 0) return null;
	return Object.freeze({ xy: Float64Array.from(reach.xy), borderHits: reach.borderHits });
}

/**
 * Returns the length of a finite interleaved XY polyline (meters) divided by its
 * endpoint distance. Reads vertices in order without mutating the input. Throws
 * RangeError for an invalid polyline, coincident endpoints or a nonfinite ratio.
 */
export function sinuosity(xy: ArrayLike<number>): number {
	const length = polylineLength(xy);
	const chord = distance(pointAt(xy, 0), pointAt(xy, xy.length - 2));
	if (chord === 0) throw new RangeError('zero-chord');
	const ratio = length / chord;
	if (!Number.isFinite(ratio)) throw new RangeError('non-finite-sinuosity');
	return ratio;
}
