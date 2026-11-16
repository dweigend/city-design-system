import type { Parcel, ParcelState, Point } from './typen';
export const SPLIT_CLEARANCE = 0.001;
/** Length tolerance in m from diameter in m; pure, no error. */
export function lengthTolerance(diameter: number): number {
	return 1e-9 * Math.max(1, diameter);
}
/** Area tolerance in m² from area in m²; pure, no error. */
export function areaTolerance(area: number): number {
	return 1e-9 * Math.max(1, area);
}
/** Vector difference in m, new and without mutation. */
export function sub(a: Point, b: Point): Point {
	return [a[0] - b[0], a[1] - b[1]];
}
/** Cross product in m², without mutation. */
export function cross(a: Point, b: Point): number {
	return a[0] * b[1] - a[1] * b[0];
}
/** Dot product, unit = product of the input units; pure. */
export function dot(a: Point, b: Point): number {
	return a[0] * b[0] + a[1] * b[1];
}
/** Length in m, without mutation. */
export function norm(a: Point): number {
	return Math.hypot(...a);
}
/** Interpolation along a segment in m; t dimensionless, new point. */
export function lerp(a: Point, b: Point, t: number): Point {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
/** Ring points in m as a new list; valid vertex references assumed. */
export function points(state: ParcelState, parcel: Pick<Parcel, 'ring'>): Point[] {
	const vertices = new Map(state.vertices.map((v) => [v.id, v]));
	return parcel.ring.map((id) => {
		const v = vertices.get(id);
		if (!v) throw new Error('unknown-vertex');
		return [v.x, v.y];
	});
}
/** Directed ring edges as new pairs; the ring is not changed. */
export function edges(ring: string[]): [string, string][] {
	return ring.map((id, i) => [id, ring[(i + 1) % ring.length]]);
}
/** Signed area in m²; CCW positive, without mutation. */
export function signedArea(p: Point[]): number {
	return p.reduce((s, a, i) => s + cross(a, p[(i + 1) % p.length]), 0) / 2;
}
/** Diameter in m, a new computation without mutation. */
export function diameter(p: Point[]): number {
	return Math.max(1, ...p.flatMap((a) => p.map((b) => norm(sub(a, b)))));
}
/** Convexity with scale-aware tolerance, collinear allowed; pure. */
export function isConvex(p: Point[]): boolean {
	const t = lengthTolerance(diameter(p)) * diameter(p);
	return p.every(
		(a, i) =>
			cross(sub(p[(i + 1) % p.length], a), sub(p[(i + 2) % p.length], p[(i + 1) % p.length])) >= -t
	);
}
/** Intersection of two lines in m, null if parallel; inputs unchanged. */
export function lineIntersection(a: Point, u: Point, b: Point, v: Point): Point | null {
	const d = cross(u, v);
	return Math.abs(d) <= 1e-12 * norm(u) * norm(v)
		? null
		: lerp(a, [a[0] + u[0], a[1] + u[1]], cross(sub(b, a), v) / d);
}
/** Segment intersection with scale-aware tolerance; proper excludes touching; pure. */
export function segmentIntersection(
	a: Point,
	b: Point,
	c: Point,
	d: Point,
	proper = false
): boolean {
	const u = sub(b, a),
		v = sub(d, c),
		den = cross(u, v),
		tol = lengthTolerance(Math.max(norm(u), norm(v)));
	if (Math.abs(den) > tol * Math.max(norm(u), norm(v))) {
		const t = cross(sub(c, a), v) / den,
			s = cross(sub(c, a), u) / den;
		const e = tol / Math.max(1, norm(u), norm(v));
		return proper
			? t > e && t < 1 - e && s > e && s < 1 - e
			: t >= -e && t <= 1 + e && s >= -e && s <= 1 + e;
	}
	if (proper || Math.abs(cross(sub(c, a), u)) > tol * norm(u)) return false;
	const l = dot(u, u);
	if (!l) return norm(sub(a, c)) <= tol;
	const t = dot(sub(c, a), u) / l,
		s = dot(sub(d, a), u) / l;
	return Math.max(Math.min(t, s), 0) <= Math.min(Math.max(t, s), 1) + tol / norm(u);
}
/** Checks the simplicity of the ring including collinear touching; pure. */
export function isSimple(p: Point[]): boolean {
	return p.every(
		(a, i) =>
			norm(sub(a, p[(i + 1) % p.length])) > lengthTolerance(diameter(p)) &&
			p.every(
				(c, j) =>
					i === j ||
					(i + 1) % p.length === j ||
					(j + 1) % p.length === i ||
					!segmentIntersection(a, p[(i + 1) % p.length], c, p[(j + 1) % p.length])
			)
	);
}
/** Monotone convex hull as a new CCW list in m; collinear intermediate points are dropped. */
export function convexHull(p: Point[]): Point[] {
	const sorted = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const half = (list: Point[]) => {
		const h: Point[] = [];
		for (const q of list) {
			while (
				h.length > 1 &&
				cross(sub(h[h.length - 1], h[h.length - 2]), sub(q, h[h.length - 1])) <= 0
			)
				h.pop();
			h.push(q);
		}
		return h.slice(0, -1);
	};
	return [...half(sorted), ...half([...sorted].reverse())];
}
/** Minimal OBB in m; the first hull edge wins an area tie; no angle/no mutation. */
export function obb(p: Point[]): { center: Point; axis: Point; long: number; short: number } {
	const h = convexHull(p);
	let best = { center: p[0], axis: [1, 0] as Point, long: 0, short: 0 },
		area = Infinity;
	for (let i = 0; i < h.length; i++) {
		const d = sub(h[(i + 1) % h.length], h[i]),
			u: Point = [d[0] / norm(d), d[1] / norm(d)],
			v: Point = [-u[1], u[0]];
		const x = h.map((q) => dot(q, u)),
			y = h.map((q) => dot(q, v));
		const lo = Math.min(...x),
			hi = Math.max(...x),
			bottom = Math.min(...y),
			top = Math.max(...y),
			w = hi - lo,
			t = top - bottom;
		if (w * t < area - areaTolerance(Number.isFinite(area) ? area : 0)) {
			area = w * t;
			best = {
				center: [
					(u[0] * (lo + hi)) / 2 + (v[0] * (bottom + top)) / 2,
					(u[1] * (lo + hi)) / 2 + (v[1] * (bottom + top)) / 2
				],
				axis: w >= t ? u : v,
				long: Math.max(w, t),
				short: Math.min(w, t)
			};
		}
	}
	return best;
}
