/** Quantizes finite meters once, with half ties toward positive infinity. */
export function toMillimeters(meters: number): number {
	if (!Number.isFinite(meters)) throw new RangeError('invalid-height-m');
	const millimeters = Math.round(meters * 1000);
	if (millimeters < -2147483648 || millimeters > 2147483647) {
		throw new RangeError('height-mm-overflow');
	}
	return millimeters || 0;
}
