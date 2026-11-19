import type { Point2 } from '../vocab';

/** Plane geometry for footprints. Polygons counter-clockwise, meters. */
export const rotate = ([x, y]: Point2, a: number): Point2 => [
	x * Math.cos(a) - y * Math.sin(a),
	x * Math.sin(a) + y * Math.cos(a)
];

/** Signed area in m² (shoelace): positive for counter-clockwise rings, negative for clockwise. */
export function area(poly: Point2[]) {
	let s = 0;
	for (let i = 0; i < poly.length; i++) {
		const [x0, y0] = poly[i],
			[x1, y1] = poly[(i + 1) % poly.length];
		s += x0 * y1 - x1 * y0;
	}
	return s / 2;
}

/** Even-odd point-in-polygon test; points exactly on the boundary are not guaranteed either way. */
export function contains(poly: Point2[], [x, y]: Point2) {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i],
			[xj, yj] = poly[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

/** Shortest distance from a point to the polygon boundary. */
export function inradius(poly: Point2[], [x, y]: Point2) {
	let best = Infinity;
	for (let i = 0; i < poly.length; i++) {
		const [ax, ay] = poly[i],
			[bx, by] = poly[(i + 1) % poly.length];
		const dx = bx - ax,
			dy = by - ay,
			t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
		best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
	}
	return best;
}

/** Scales a polygon about a point: s < 1 shrinks it towards the point. */
export const scaleAbout = (poly: Point2[], [cx, cy]: Point2, s: number): Point2[] =>
	poly.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s]);

/**
 * Parallel inset by d meters (convex cells; concave corners are clamped).
 * Falls back to scaling when the inset collapses.
 */
export function inset(poly: Point2[], d: number, center: Point2): Point2[] {
	if (d <= 0) return poly;
	const ccw = area(poly) >= 0 ? 1 : -1;
	const n = poly.length,
		out: Point2[] = [];
	for (let i = 0; i < n; i++) {
		const p0 = poly[(i - 1 + n) % n],
			p1 = poly[i],
			p2 = poly[(i + 1) % n];
		const e0 = norm([p1[0] - p0[0], p1[1] - p0[1]]),
			e1 = norm([p2[0] - p1[0], p2[1] - p1[1]]);
		// Inward normals of both edges.
		const n0: Point2 = [-e0[1] * ccw, e0[0] * ccw],
			n1: Point2 = [-e1[1] * ccw, e1[0] * ccw];
		const bis = norm([n0[0] + n1[0], n0[1] + n1[1]]);
		const cos = Math.max(0.25, bis[0] * n1[0] + bis[1] * n1[1]);
		out.push([p1[0] + (bis[0] * d) / cos, p1[1] + (bis[1] * d) / cos]);
	}
	const r = inradius(poly, center);
	if (d >= r * 0.92 || area(out) * ccw <= 0)
		return scaleAbout(poly, center, Math.max(0.05, 1 - d / Math.max(r, 0.01)));
	return out;
}
const norm = ([x, y]: Point2): Point2 => {
	const l = Math.hypot(x, y) || 1;
	return [x / l, y / l];
};

/** Polygon bounds in the local frame (rotated by −a about c). */
export function localBounds(poly: Point2[], c: Point2, a: number) {
	let minU = Infinity,
		maxU = -Infinity,
		minV = Infinity,
		maxV = -Infinity;
	for (const p of poly) {
		const [u, v] = rotate([p[0] - c[0], p[1] - c[1]], -a);
		minU = Math.min(minU, u);
		maxU = Math.max(maxU, u);
		minV = Math.min(minV, v);
		maxV = Math.max(maxV, v);
	}
	return { minU, maxU, minV, maxV };
}

/**
 * Largest rectangle aligned to the cell orientation that fits inside the footprint.
 * Search over center offsets and aspect; returns local frame (center, half extents).
 */
export function fitRect(poly: Point2[], c: Point2, a: number) {
	const b = localBounds(poly, c, a);
	const inside = (cu: number, cv: number, hu: number, hv: number) =>
		[
			[cu - hu, cv - hv],
			[cu + hu, cv - hv],
			[cu + hu, cv + hv],
			[cu - hu, cv + hv]
		].every(([u, v]) => {
			const [x, y] = rotate([u, v], a);
			return contains(poly, [c[0] + x, c[1] + y]);
		});
	let best = { cu: 0, cv: 0, hu: 0.5, hv: 0.5, score: 0 };
	const span = Math.max(b.maxU - b.minU, b.maxV - b.minV);
	for (const aspect of [0.6, 0.8, 1, 1.25, 1.6])
		for (const du of [-0.15, -0.08, 0, 0.08, 0.15])
			for (const dv of [-0.15, -0.08, 0, 0.08, 0.15]) {
				const cu = du * (b.maxU - b.minU),
					cv = dv * (b.maxV - b.minV);
				let lo = 0,
					hi = span;
				for (let k = 0; k < 18; k++) {
					const s = (lo + hi) / 2;
					if (inside(cu, cv, s * Math.sqrt(aspect), s / Math.sqrt(aspect))) lo = s;
					else hi = s;
				}
				const hu = lo * Math.sqrt(aspect),
					hv = lo / Math.sqrt(aspect),
					// Prefer area, mildly prefer square and centered rectangles.
					score =
						hu * hv * (1 - 0.08 * Math.abs(Math.log(aspect))) * (1 - 0.3 * Math.hypot(du, dv));
				if (score > best.score) best = { cu, cv, hu, hv, score };
			}
	return best;
}

/** Evenly spread points inside a polygon (dart throwing, deterministic through rng). */
export function scatter(
	poly: Point2[],
	count: number,
	gap: number,
	rng: () => number,
	margin = 0
): Point2[] {
	const xs = poly.map((p) => p[0]),
		ys = poly.map((p) => p[1]);
	const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	const out: Point2[] = [];
	for (let tries = 0; tries < count * 60 && out.length < count; tries++) {
		const p: Point2 = [x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0)];
		if (!contains(poly, p) || inradius(poly, p) < margin) continue;
		if (out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < gap)) continue;
		out.push(p);
	}
	return out;
}
