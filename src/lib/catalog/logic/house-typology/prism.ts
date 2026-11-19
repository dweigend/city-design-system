type XY = [number, number];
type Edge = { at: (x: number) => number; lo: number; hi: number };
/** Splits a simple footprint with holes into convex trapezoids, in x-slab order. */
export function prismFaces(rings: XY[][]): XY[][] {
	const xs = [...new Set(rings.flat().map((p) => p[0]))].sort((a, b) => a - b);
	const edges: Edge[] = rings.flatMap((r) =>
		r.flatMap(([x, y], i) => {
			const [u, v] = r[(i + 1) % r.length];
			return x === u
				? []
				: [
						{
							at: (t: number) => y + ((v - y) * (t - x)) / (u - x),
							lo: Math.min(x, u),
							hi: Math.max(x, u)
						}
					];
		})
	);
	const faces: XY[][] = [];
	for (let i = 1; i < xs.length; i++) {
		const l = xs[i - 1],
			r = xs[i],
			mid = (l + r) / 2;
		const crossing = edges
			.filter((e) => e.lo < mid && e.hi > mid)
			.sort((a, b) => a.at(mid) - b.at(mid));
		for (let j = 1; j < crossing.length; j += 2) {
			const a = crossing[j - 1],
				b = crossing[j];
			faces.push([
				[l, a.at(l)],
				[r, a.at(r)],
				[r, b.at(r)],
				[l, b.at(l)]
			]);
		}
	}
	return faces;
}
