/** Interpolates a scalar on the shared 0–2 diagonal of a terrain parcel. */
export function chartScalar(q: readonly number[], u: number, v: number) {
	return q[0] + Math.abs(u - v) * (q[u >= v ? 1 : 3] - q[0]) + Math.min(u, v) * (q[2] - q[0]);
}

/** Samples a scalar field from a regular refinement of that triangular chart. */
export function sampleSlot(values: number[], n: number, u: number, v: number) {
	const x = u * n,
		y = v * n,
		i = Math.min(n - 1, Math.floor(x)),
		j = Math.min(n - 1, Math.floor(y));
	const a = j * (n + 1) + i;
	return chartScalar(
		[values[a], values[a + 1], values[a + n + 2], values[a + n + 1]],
		x - i,
		y - j
	);
}
