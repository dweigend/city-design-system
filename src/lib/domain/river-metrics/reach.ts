import { defaults } from '../../../config/river-metrics';
import { distance, pointAt, polylineLength } from '../../core/polyline';

const { wavelengthHeadingCrossingToleranceRatio } = defaults;

/** A downstream centerline in meters, constant wet and bankfull widths in meters,
 * and the mean downstream axis bearing in radians from +X.
 */
export type RiverGeometry = Readonly<{
	xy: ArrayLike<number>;
	wetWidth: number;
	bankfullWidth: number;
	bearing: number;
}>;

// Exact arithmetic: one vertex occupies two entries in the interleaved XY array.
const xyStride = 2;

// An oscillation from one axis heading crossing to the next spans half a wave.
function meanWavelength(xy: ArrayLike<number>, bearing: number): number | null {
	let length = 0;
	let first = 0;
	let last = 0;
	let count = 0;
	let previousAcross = 0;
	let previousStation = 0;
	const x = -Math.sin(bearing);
	const y = Math.cos(bearing);
	for (let i = xyStride; i < xy.length; i += xyStride) {
		const dx = xy[i] - xy[i - xyStride];
		const dy = xy[i + 1] - xy[i - 1];
		const segment = Math.hypot(dx, dy);
		const across = (dx * x + dy * y) / segment;
		const station = length + segment / 2;
		if (Math.abs(across) <= wavelengthHeadingCrossingToleranceRatio) {
			length += segment;
			continue;
		}
		if (previousAcross !== 0 && Math.sign(previousAcross) !== Math.sign(across)) {
			last =
				previousStation +
				((station - previousStation) * -previousAcross) / (across - previousAcross);
			if (count === 0) first = last;
			count++;
		}
		length += segment;
		previousAcross = across;
		previousStation = station;
	}
	return count <= 1 ? null : (2 * (last - first)) / (count - 1);
}

/** Measures the supplied reach without mutation. Valley length is the endpoint chord.
 * Wavelength is averaged along `waveCourse` (defaults to the reach), which may extend
 * beyond the reach window. A course with fewer than two crossings has no wavelength.
 * Throws RangeError for a malformed line, coincident endpoints, or invalid widths or axis.
 */
export function measureRiver(river: RiverGeometry, waveCourse = river.xy) {
	const { xy, bearing, wetWidth, bankfullWidth } = river;
	if (
		![wetWidth, bankfullWidth, bearing].every(Number.isFinite) ||
		wetWidth <= 0 ||
		bankfullWidth < wetWidth
	)
		throw new RangeError('invalid-river');
	const riverLength = polylineLength(xy);
	const valleyLength = distance(pointAt(xy, 0), pointAt(xy, xy.length - xyStride));
	if (valleyLength === 0) throw new RangeError('zero-chord');
	const sinuosity = riverLength / valleyLength;
	if (!Number.isFinite(sinuosity)) throw new RangeError('non-finite-sinuosity');
	if (waveCourse !== xy) polylineLength(waveCourse);
	const wavelength = meanWavelength(waveCourse, bearing);
	return Object.freeze({
		riverLength,
		valleyLength,
		sinuosity,
		wetWidth,
		bankfullWidth,
		wavelength,
		wavelengthToWidth: wavelength === null ? null : wavelength / bankfullWidth
	});
}
