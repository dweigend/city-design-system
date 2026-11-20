/** Effective run in metres. An eased first and last metre gives a horizontal tangent at a landing. */
export function easedRun(x: number, length: number) {
	const lead = Math.min(1, length / 2);
	const start = (s: number) => {
		const t = s / lead;
		return lead * t ** 3 * (1 - 0.5 * t);
	};
	if (x < lead) return start(x);
	if (x > length - lead) return length - lead - start(length - x);
	return x - 0.5 * lead;
}
/** Filters the Lipschitz height envelope with a uniform cubic B-spline, retaining exact endpoints. */
export function ribbonRise(distances: number[], heights: number[], closed = false) {
	const length = distances[distances.length - 1],
		bays = Math.max(1, Math.ceil(length / 1.5)),
		step = length / bays;
	let j = 0;
	const knots = Array.from({ length: bays + 1 }, (_, i) => {
		const d = i * step;
		while (j + 1 < distances.length - 1 && distances[j + 1] < d) j++;
		const t = (d - distances[j]) / (distances[j + 1] - distances[j]);
		return heights[j] + t * (heights[j + 1] - heights[j]);
	});
	const k = [
		closed ? knots[bays - 1] : 2 * knots[0] - knots[1],
		...knots,
		closed ? knots[1] : 2 * knots[bays] - knots[bays - 1]
	];
	return distances.map((d, n) => {
		if (!closed && (n === 0 || n === heights.length - 1)) return heights[n];
		const i = Math.min(bays - 1, Math.floor(d / step)),
			t = d / step - i,
			u = 1 - t;
		return (
			(u ** 3 * k[i] +
				(3 * t ** 3 - 6 * t * t + 4) * k[i + 1] +
				(-3 * t ** 3 + 3 * t * t + 3 * t + 1) * k[i + 2] +
				t ** 3 * k[i + 3]) /
			6
		);
	});
}
