// Exact arithmetic: one meter is 1,000 millimeters.
export const millimetersPerMeter = 1000;

// Exact arithmetic: the signed 32-bit storage range of the catchment raster.
const minimumInt32 = -2147483648;
// Exact arithmetic: the signed 32-bit storage range of the catchment raster.
const maximumInt32 = 2147483647;

/** Quantizes finite meters once, with half ties toward positive infinity. */
export function toMillimeters(meters: number): number {
	if (!Number.isFinite(meters)) throw new RangeError('invalid-height-m');
	const millimeters = Math.round(meters * millimetersPerMeter);
	if (millimeters < minimumInt32 || millimeters > maximumInt32) {
		throw new RangeError('height-mm-overflow');
	}
	return millimeters || 0;
}
