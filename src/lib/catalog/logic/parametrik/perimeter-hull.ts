import type { Point2 } from './vocab';
/** Convex hull (monotone chain), counterclockwise. */
export function perimeterHull(points: Point2[]): Point2[] {
	const ps = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const cross = (o: Point2, a: Point2, b: Point2) =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const half = (list: Point2[]) => {
		const out: Point2[] = [];
		for (const q of list) {
			while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 1e-9)
				out.pop();
			out.push(q);
		}
		return out.slice(0, -1);
	};
	return [...half(ps), ...half([...ps].reverse())];
}
