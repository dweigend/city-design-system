import type { CourtFront, TerrainGrid } from './types';
import { wallContact } from './wall-contact';

type Wall = Omit<Parameters<typeof wallContact>[1], 'court'>;
type XY = Wall['a'];
const eps = 1e-8; // Metric tolerance at the edge of a graded bank.

// Clip a linear coordinate to one closed chart interval.
function interval(a: number, b: number, limit: number): [number, number] | undefined {
	if (Math.abs(b - a) < eps) return a >= -eps && a <= limit + eps ? [0, 1] : undefined;
	const lo = -a / (b - a),
		hi = (limit - a) / (b - a);
	return [Math.min(lo, hi), Math.max(lo, hi)];
}

function match(front: CourtFront, wall: Wall) {
	const dx = front.b[0] - front.a[0],
		dy = front.b[1] - front.a[1],
		length = Math.hypot(dx, dy);
	const tx = dx / length,
		ty = dy / length;
	const along = (p: XY) => (p[0] - front.a[0]) * tx + (p[1] - front.a[1]) * ty;
	const away = (p: XY) => (p[0] - front.a[0]) * front.nx + (p[1] - front.a[1]) * front.ny;
	const s = along(wall.a),
		t = along(wall.b),
		d = away(wall.a),
		e = away(wall.b);
	// A frontage runs more along the court than across it (within 45 degrees).
	if (Math.abs(t - s) <= Math.abs(e - d)) return;
	const tangent = interval(s, t, length),
		normal = interval(d, e, front.reach);
	if (!tangent || !normal) return;
	const start = Math.max(wall.start, tangent[0], normal[0]),
		end = Math.min(wall.end, tangent[1], normal[1]);
	if (end - start <= eps) return;
	const at = (u: number): XY => [
		front.a[0] + tx * (s + (t - s) * u),
		front.a[1] + ty * (s + (t - s) * u)
	];
	const depth = (u: number) => d + (e - d) * u;
	const left = (s < t ? 1 : -1) * (tx * front.ny - ty * front.nx) > 0;
	const court = (a: number, b: number) => ({
		...front,
		a: at(a),
		b: at(b),
		earthSide: left ? ('left' as const) : ('right' as const)
	});
	return { start, end, depth, court };
}

type Match = NonNullable<ReturnType<typeof match>>;

function breaks(matches: Match[], wall: Wall) {
	const points = new Set([wall.start, wall.end, ...matches.flatMap((m) => [m.start, m.end])]);
	for (const [i, a] of matches.entries())
		for (const b of matches.slice(i + 1)) {
			const lo = Math.max(a.start, b.start),
				hi = Math.min(a.end, b.end);
			const x = a.depth(lo) - b.depth(lo),
				y = a.depth(hi) - b.depth(hi);
			if (lo < hi && x * y < 0) points.add(lo + ((hi - lo) * x) / (x - y));
		}
	return [...points].sort((a, b) => a - b);
}

/** Surveys a whole directed wall interval and locates adjacent court edges on the graded
 * grid. Splits at court ends and at changes of nearest frontage. Each returned interval
 * can be consumed independently by the envelope or terrain projection. */
export function wallContacts(grid: TerrainGrid, wall: Wall) {
	const matches = (grid.courtFronts ?? []).flatMap((f) => match(f, wall) ?? []);
	if (!matches.length) return [wallContact(grid, wall)];
	const points = breaks(matches, wall);
	return points.slice(1).map((end, i) => {
		const start = points[i],
			mid = (start + end) / 2;
		const front = matches
			.filter((m) => mid >= m.start && mid <= m.end)
			.sort((a, b) => a.depth(mid) - b.depth(mid))[0];
		return wallContact(grid, { ...wall, start, end, court: front?.court(start, end) });
	});
}
