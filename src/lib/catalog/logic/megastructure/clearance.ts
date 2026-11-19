import type { Vec3 } from '../statik';
/** Length strictly inside a convex counter-clockwise ground polygon; touching a boundary is allowed. */
export function interiorLength(a: Vec3, b: Vec3, ring: readonly Vec3[]) {
	let lo = 0,
		hi = 1;
	for (const [i, p] of ring.entries()) {
		const q = ring[(i + 1) % ring.length],
			dx = q[0] - p[0],
			dy = q[1] - p[1];
		const start = dx * (a[1] - p[1]) - dy * (a[0] - p[0]);
		const end = dx * (b[1] - p[1]) - dy * (b[0] - p[0]);
		if (start <= 0 && end <= 0) return 0;
		if (start <= 0) lo = Math.max(lo, start / (start - end));
		if (end <= 0) hi = Math.min(hi, start / (start - end));
	}
	return Math.max(0, hi - lo) * Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** True for a crossing or shared interval in plan. Meeting at an endpoint is permitted. */
export function crossesGap(a: Vec3, b: Vec3, [c, d]: readonly [Vec3, Vec3]) {
	const turn = (p: Vec3, q: Vec3, r: Vec3) =>
		(q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
	const ca = turn(c, d, a),
		cb = turn(c, d, b),
		ac = turn(a, b, c),
		ad = turn(a, b, d);
	if (ca * cb < 0 && ac * ad < 0) return true;
	if (ca !== 0 || cb !== 0) return false;
	const i = Math.abs(d[0] - c[0]) >= Math.abs(d[1] - c[1]) ? 0 : 1;
	return (
		Math.min(Math.max(a[i], b[i]), Math.max(c[i], d[i])) >
		Math.max(Math.min(a[i], b[i]), Math.min(c[i], d[i]))
	);
}
