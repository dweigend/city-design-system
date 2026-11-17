import type { Cell, Grid, GridKind, Point2 } from '../vocab';
import { triangulate } from './earcut';
export const cross = (a: Point2, b: Point2, c: Point2) =>
	(b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export const area = (p: Point2[]) =>
	p.reduce((s, a, i) => {
		const b = p[(i + 1) % p.length];
		return s + a[0] * b[1] - b[0] * a[1];
	}, 0) / 2;
export const key = (p: Point2) =>
	p.map((v) => (Math.abs(v) < 0.0000005 ? 0 : v).toFixed(6)).join(',');
export const midpoint = (a: Point2, b: Point2): Point2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export function cell(polygon: Point2[], id: string, level = 0): Cell {
	const p = area(polygon) < 0 ? [...polygon].reverse() : polygon;
	const a = area(p);
	const center: Point2 = [0, 0];
	let longest = 0,
		orientation = 0;
	p.forEach((v, i) => {
		const w = p[(i + 1) % p.length],
			c = v[0] * w[1] - w[0] * v[1];
		center[0] += ((v[0] + w[0]) * c) / (6 * a);
		center[1] += ((v[1] + w[1]) * c) / (6 * a);
		const d = Math.hypot(w[0] - v[0], w[1] - v[1]);
		if (d > longest) {
			longest = d;
			orientation = Math.atan2(w[1] - v[1], w[0] - v[0]);
		}
	});
	return { id, polygon: p, area: a, center, orientation, neighbors: [], level };
}
export function clip(p: Point2[], normal: Point2, limit: number): Point2[] {
	const result: Point2[] = [];
	p.forEach((a, i) => {
		const b = p[(i + 1) % p.length],
			da = a[0] * normal[0] + a[1] * normal[1] - limit,
			db = b[0] * normal[0] + b[1] * normal[1] - limit;
		if (da <= 1e-9) result.push(a);
		if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
			const t = da / (da - db);
			result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
		}
	});
	return result.filter((p, i) => key(p) !== key(result[(i + 1) % result.length]));
}
export function intersect(p: Point2[], boundary: Point2[]): Point2[] {
	const b = area(boundary) > 0 ? boundary : [...boundary].reverse();
	return b.reduce((out, a, i) => {
		const c = b[(i + 1) % b.length],
			n: Point2 = [c[1] - a[1], a[0] - c[0]];
		return clip(out, n, n[0] * a[0] + n[1] * a[1]);
	}, p);
}
/** Splits a simple polygon into triangles (earcut order); returns the original point objects. */
export function triangles(p: Point2[]): Point2[][] {
	return triangulate(p).map((t) => t.map((i) => p[i]));
}
export function convexParts(p: Point2[]): Point2[][] {
	const q = area(p) > 0 ? p : [...p].reverse();
	return q.every((v, i) => cross(v, q[(i + 1) % q.length], q[(i + 2) % q.length]) >= -1e-8)
		? [q]
		: triangles(q);
}
function sharesEdge(a: Cell, b: Cell) {
	return a.polygon.some((p, i) => {
		const q = a.polygon[(i + 1) % a.polygon.length];
		const dx = q[0] - p[0],
			dy = q[1] - p[1],
			len = Math.hypot(dx, dy);
		return b.polygon.some((r, j) => {
			const s = b.polygon[(j + 1) % b.polygon.length];
			if (Math.abs(cross(p, q, r)) > 1e-6 * len || Math.abs(cross(p, q, s)) > 1e-6 * len)
				return false;
			const t = (v: Point2) => ((v[0] - p[0]) * dx + (v[1] - p[1]) * dy) / len;
			return Math.min(len, Math.max(t(r), t(s))) - Math.max(0, Math.min(t(r), t(s))) > 1e-6;
		});
	});
}
export function grid(kind: GridKind, cells: Cell[]): Grid {
	cells = cells.filter((c) => c.area > 1e-7);
	cells.forEach((c) => (c.neighbors = []));
	const links: Grid['links'] = [];
	for (let i = 0; i < cells.length; i++)
		for (let j = i + 1; j < cells.length; j++) {
			const a = cells[i],
				b = cells[j];
			const vertical = Math.abs(a.level - b.level) === 1 && key(a.center) === key(b.center);
			if (vertical || (a.level === b.level && sharesEdge(a, b))) {
				links.push([a.id, b.id]);
				a.neighbors.push(b.id);
				b.neighbors.push(a.id);
			}
		}
	const points = cells.flatMap((c) => c.polygon);
	return {
		kind,
		cells,
		links,
		bounds: {
			min: points.length
				? [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))]
				: [0, 0],
			max: points.length
				? [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))]
				: [0, 0]
		}
	};
}
export function subdivide(p: Point2[]): Point2[][] {
	const c = cell(p, '').center;
	return p.map((v, i) => [
		v,
		midpoint(v, p[(i + 1) % p.length]),
		c,
		midpoint(p[(i + p.length - 1) % p.length], v)
	]);
}
