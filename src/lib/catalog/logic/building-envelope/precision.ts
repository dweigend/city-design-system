/** Plan distances below this many local metres are coincident. */
export const epsilon = 1e-7;

/** Resolution shared by roof construction and Float32 shell extraction, in local metres. */
export function localResolution(extent: number) {
	if (!Number.isFinite(Math.fround(extent)))
		throw new RangeError('Envelope exceeds local coordinate range');
	return Math.max(epsilon, extent * 2 ** -23);
}
