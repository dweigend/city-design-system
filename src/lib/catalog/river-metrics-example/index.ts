import { clipPolylineToSquare, sinuosity } from '../logic/river-metrics';

/** Measures a river's longest reach within a centered square using the supplied XY
 * sequence and side length in meters. Returns a detached result or null for no reach,
 * and throws RangeError for invalid coordinates or window. Does not change the input.
 */
export function measureRiverReach(xy: ArrayLike<number>, windowM: number) {
	const reach = clipPolylineToSquare(xy, windowM);
	if (!reach) return null;
	return { ratio: sinuosity(reach.xy), borderHits: reach.borderHits };
}
