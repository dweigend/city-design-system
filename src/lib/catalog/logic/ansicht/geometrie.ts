/**
 * Geometry of the view layer: bounding boxes, translation, polygon clipping.
 * Pure, without three.js; works on primitives only (world coordinates x/y ground, z height).
 */
import { transformAnchors, type Primitive, type Vec3 } from '../parametrik/types';

export type Bounds = { min: Vec3; max: Vec3 };
export type Point2 = [number, number];

const span = (points: Vec3[], pad = 0, padZ = pad): Bounds => {
	const min: Vec3 = [Infinity, Infinity, Infinity],
		max: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const p of points)
		for (let i = 0; i < 3; i++) {
			min[i] = Math.min(min[i], p[i]);
			max[i] = Math.max(max[i], p[i]);
		}
	return {
		min: [min[0] - pad, min[1] - pad, min[2] - padZ],
		max: [max[0] + pad, max[1] + pad, max[2] + padZ]
	};
};
const around = ([x, y]: Vec3, r: number, z0: number, z1: number): Bounds => ({
	min: [x - r, y - r, z0],
	max: [x + r, y + r, z1]
});

/** Axis-aligned bounding box of a primitive (rotation about the center roughly via the circumcircle). */
export function bounds(p: Primitive): Bounds {
	switch (p.kind) {
		case 'prism': {
			const poly = rotated(p.polygon, p.rotation ?? 0);
			return span([
				...poly.map(([x, y]): Vec3 => [x, y, p.z]),
				[poly[0][0], poly[0][1], p.z + p.height]
			]);
		}
		case 'polyline':
			return span(p.points);
		case 'pipe':
			return span(p.points, p.radius);
		case 'capsule':
			return span([p.from, p.to], p.radius);
		case 'membrane': {
			const b = span(p.corners);
			b.min[2] -= p.sag ?? 0;
			return b;
		}
		case 'box':
		case 'wedge':
		case 'frame': {
			const [x, y, z] = p.position,
				[w, d, h] = p.size;
			if (!p.rotation) return { min: [x, y, z], max: [x + w, y + d, z + h] };
			return around([x + w / 2, y + d / 2, 0], Math.hypot(w, d) / 2, z, z + h);
		}
		case 'cylinder':
		case 'cone':
			return around(p.position, p.radius, p.position[2], p.position[2] + p.height);
		case 'helix':
			return around(p.position, p.radius, p.position[2], p.position[2] + p.height);
		case 'sphere': {
			const r = p.radius * (p.squash ?? 1);
			return around(p.position, p.radius, p.position[2] - r, p.position[2] + r);
		}
		case 'dome':
			return around(p.position, p.radius, p.position[2], p.position[2] + (p.height ?? p.radius));
		case 'ring':
			return around(p.position, p.radius, p.position[2] - p.radius, p.position[2] + p.radius);
		case 'torus': {
			const r = p.radius + p.tube,
				up = p.axis === 'z' ? p.tube : r;
			return around(p.position, r, p.position[2] - up, p.position[2] + up);
		}
		case 'arch':
		case 'vault':
		case 'halfpipe':
			return around(
				p.position,
				Math.hypot(p.width, p.length) / 2,
				p.position[2],
				p.position[2] + p.rise
			);
	}
}

export const center = (b: Bounds): Vec3 => [
	(b.min[0] + b.max[0]) / 2,
	(b.min[1] + b.max[1]) / 2,
	(b.min[2] + b.max[2]) / 2
];

export function union(list: Bounds[]): Bounds {
	return span(list.flatMap((b) => [b.min, b.max]));
}

/** Moves a primitive by d (meters). */
export function translate(primitive: Primitive, [dx, dy, dz]: Vec3): Primitive {
	if (!dx && !dy && !dz) return primitive;
	const move = ([x, y, z]: Vec3): Vec3 => [x + dx, y + dy, z + dz];
	const p = transformAnchors(primitive, move);
	switch (p.kind) {
		case 'pipe':
		case 'polyline':
			return { ...p, points: p.points.map(move) };
		case 'prism':
			return {
				...p,
				polygon: rotated(p.polygon, p.rotation ?? 0).map(([x, y]): Point2 => [x + dx, y + dy]),
				rotation: undefined,
				z: p.z + dz
			};
		case 'capsule':
			return { ...p, from: move(p.from), to: move(p.to) };
		case 'membrane':
			return { ...p, corners: p.corners.map(move) as [Vec3, Vec3, Vec3, Vec3] };
		default:
			return { ...p, position: move(p.position) };
	}
}

/** Rotates a polygon about the origin (prisms rotate about the world origin, see scene/parametrik). */
export function rotated(poly: Point2[], angle: number): Point2[] {
	if (!angle) return poly;
	const c = Math.cos(angle),
		s = Math.sin(angle);
	return poly.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

/** Footprint of a box as a polygon, rotated about its center. */
export function boxPolygon(position: Vec3, size: Vec3, rotation = 0): Point2[] {
	const cx = position[0] + size[0] / 2,
		cy = position[1] + size[1] / 2,
		w = size[0] / 2,
		d = size[1] / 2;
	return rotated(
		[
			[-w, -d],
			[w, -d],
			[w, d],
			[-w, d]
		],
		rotation
	).map(([x, y]) => [x + cx, y + cy]);
}

export function area(poly: Point2[]): number {
	let a = 0;
	for (let i = 0; i < poly.length; i++) {
		const [x0, y0] = poly[i],
			[x1, y1] = poly[(i + 1) % poly.length];
		a += x0 * y1 - x1 * y0;
	}
	return Math.abs(a) / 2;
}

/** Half-plane n·p ≤ d in plan. */
export type HalfPlane = { normal: Point2; d: number };
const side = (h: HalfPlane, [x, y]: Point2) => h.normal[0] * x + h.normal[1] * y - h.d;

/** Sutherland–Hodgman: keeps the part of the polygon with n·p ≤ d. */
export function clipPolygon(poly: Point2[], h: HalfPlane): Point2[] {
	const out: Point2[] = [];
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i],
			b = poly[(i + 1) % poly.length],
			sa = side(h, a),
			sb = side(h, b);
		if (sa <= 0) out.push(a);
		if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
			const t = sa / (sa - sb);
			out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		}
	}
	return out;
}

/**
 * Cut segments of the line n·p = d with the polygon (even number of intersections,
 * paired along the line). Also for non-convex polygons.
 */
export function chords(poly: Point2[], h: HalfPlane): [Point2, Point2][] {
	const tangent: Point2 = [-h.normal[1], h.normal[0]];
	const hits: Point2[] = [];
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i],
			b = poly[(i + 1) % poly.length],
			sa = side(h, a),
			sb = side(h, b);
		if ((sa < 0 && sb >= 0) || (sa >= 0 && sb < 0)) {
			const t = sa / (sa - sb);
			hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		}
	}
	hits.sort(
		(p, q) => p[0] * tangent[0] + p[1] * tangent[1] - (q[0] * tangent[0] + q[1] * tangent[1])
	);
	const out: [Point2, Point2][] = [];
	for (let i = 0; i + 1 < hits.length; i += 2) out.push([hits[i], hits[i + 1]]);
	return out;
}
