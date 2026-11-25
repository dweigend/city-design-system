/** Module: Measures river courses, wet widths and sampled banks. */
/** Clips interleaved XY meters to the longest reach in a centered square (first on ties).
 * Returns a detached reach and count of distinct border contacts, or null. Border overlap
 * counts as infinity. Sinuosity is channel length / endpoint chord. Invalid input throws RangeError.
 */
export {
	/** Clips a finite interleaved XY polyline (meters) to the closed square of side `size` centered at the origin. */
	clipPolylineToSquare,
	/** Returns the length of a finite interleaved XY polyline (meters) divided by its endpoint distance. */
	sinuosity,
	/** One detached clipped polyline in meters and its border contact count. */
	type ClippedReach
} from '../../core/polyline';
/** Reads downstream XY, wet and bankfull widths in meters, and bearing in radians.
 * Returns lengths and sinuosity plus wavelength and wavelength / bankfull width.
 * Wavelength doubles the mean interval between crossings of the mean heading. Pass a
 * longer course for this measure, which is null if fewer than two crossings are available.
 * Invalid data throws RangeError. Inputs stay untouched.
 */
export {
	/** Measures the supplied reach without mutation. */
	measureRiver,
	/** Downstream centerline and widths in meters, with mean bearing in radians from positive X. */
	type RiverGeometry
} from './reach';
/** Reads a north-first raster in millimeters and a course in meters. Measures wet and
 * dry bank widths, slope shares, smoothed relief and terrace step gains. Omits censored
 * crossings. Invalid inputs and profile scans above the sampling budget throw RangeError.
 * See world/valley-protocol for the frozen settings.
 */
export {
	/** Measures wet widths, steps, relief, and slopes from a north-first millimeter raster and a metric course. */
	measureRiverSurface,
	/** Raster spacing, smoothing, and profile sampling in meters, with dimensionless slope thresholds. */
	type SurfaceProtocol
} from './surface-metrics';
/** A centered north-first raster of bed and water heights in millimeters. */
export type { SurfaceGrid } from './surface-grid';
