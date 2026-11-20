import type { TerrainCell } from '../terrain-grid';

type Point = readonly number[];
const outside = (x: number, start: number, end: number) => x < start || x > end;
type Survey = (x: number, y: number) => number;

/** Sections of dry lot frontages expressed along and outward from one directed court edge.
 * The court generator reserves these lots before the envelope planner runs. */
export function setbackGrade(
	a: Point,
	b: Point,
	nx: number,
	ny: number,
	lots: TerrainCell[],
	ground: Survey,
	reach: number
) {
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const tx = (b[0] - a[0]) / length,
		ty = (b[1] - a[1]) / length;
	const station = (p: Point) => (p[0] - a[0]) * tx + (p[1] - a[1]) * ty;
	const out = (p: Point) => (p[0] - a[0]) * nx + (p[1] - a[1]) * ny;
	const faces = lots
		.flatMap((cell) => {
			const ring = cell.lotCorners ?? cell.corners;
			return ring.map((p, i) => {
				const q = ring[(i + 1) % ring.length];
				return {
					s: station(p),
					e: station(q),
					d: out(p),
					f: out(q),
					z: ground(p[0], p[1]),
					w: ground(q[0], q[1])
				};
			});
		})
		.filter(
			(r) =>
				Math.max(r.s, r.e) >= 0 &&
				Math.min(r.s, r.e) <= length &&
				Math.max(r.d, r.f) > 0 &&
				Math.min(r.d, r.f) < reach &&
				Math.abs(r.e - r.s) > 1e-7 &&
				Number.isFinite(r.z + r.w)
		);
	return (p: Point, top: number) => {
		const s = station(p),
			d = out(p);
		if (d <= 0 || outside(s, 0, length)) return;
		let width = reach,
			z = 0,
			found = false;
		for (const face of faces) {
			const u = (s - face.s) / (face.e - face.s);
			const run = face.d + (face.f - face.d) * u;
			if (outside(u, 0, 1) || run <= 0 || run >= width) continue;
			width = run;
			z = face.z + (face.w - face.z) * u;
			found = true;
		}
		if (found && d <= width) return top + ((z - top) * d) / width;
	};
}
