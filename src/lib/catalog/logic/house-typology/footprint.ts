import type { QuadCell } from '../quad-grid';
type XY = [number, number];
/** Fits an axis-aligned bay to the exterior sides of the actual union. Courtyards remain empty. */
export function footprintBay(cells: readonly QuadCell[]) {
	const ids = new Set(cells.map((c) => c.id));
	const sides = cells.flatMap((cell) =>
		cell.corners.flatMap((a, i) =>
			ids.has(cell.neighbors[i] ?? '') ? [] : [[a, cell.corners[(i + 1) % 4]]]
		)
	);
	const xs = cells.flatMap((c) => c.corners.map((p) => p[0])),
		ys = cells.flatMap((c) => c.corners.map((p) => p[1]));
	const spanX = Math.max(...xs) - Math.min(...xs),
		spanY = Math.max(...ys) - Math.min(...ys);
	const middle: XY = [
		(Math.max(...xs) + Math.min(...xs)) / 2,
		(Math.max(...ys) + Math.min(...ys)) / 2
	];
	const candidates: XY[] = cells.flatMap((c) => [
		[c.center[0], c.center[1]] as XY,
		...c.corners.flatMap(([x, y], i): XY[] => {
			const next = c.corners[(i + 1) % 4];
			return [
				[x, y],
				[(x + next[0]) / 2, (y + next[1]) / 2]
			];
		})
	]);
	if (
		cells.some((c) =>
			c.corners.every(([x, y], i) => {
				const b = c.corners[(i + 1) % 4];
				return (b[0] - x) * (middle[1] - y) >= (b[1] - y) * (middle[0] - x);
			})
		)
	)
		candidates.unshift(middle);
	let best = { x: middle[0], y: middle[1], width: 0, depth: 0 };
	for (const aspect of [1, 0.5, 2, 0.25, 4])
		for (const [x, y] of candidates) {
			const w = spanX * aspect,
				d = spanY;
			// Minimum scaled L-infinity distance to each segment occurs at an end or |dx| = |dy|.
			const scale = Math.min(
				...sides.map(([a, b]) => {
					const u = (a[0] - x) / w,
						v = (a[1] - y) / d,
						du = (b[0] - a[0]) / w,
						dv = (b[1] - a[1]) / d;
					const ts = [
						0,
						1,
						...[1, -1].map((s) => (s * v - u) / (du - s * dv)).filter((t) => t > 0 && t < 1)
					];
					return Math.min(...ts.map((t) => Math.max(Math.abs(u + du * t), Math.abs(v + dv * t))));
				})
			);
			if (4 * w * d * scale * scale > best.width * best.depth + 1e-9)
				best = { x, y, width: 2 * w * scale, depth: 2 * d * scale };
		}
	return best;
}
