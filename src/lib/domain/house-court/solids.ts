import type { Vec2, Vec3 } from '../../core/geometry';
import { defaults } from '../../../config/house-court';
import { side } from './boxes';

const { curveSegments, domeRings, wedgeLowRatio } = defaults;

/** Closed planar faces wound outward, joined into a mesh by `faceMesh`. */
export type Faces = Vec3[][];

// Exact arithmetic: vertex average.
function centre(points: readonly Vec2[]): Vec2 {
	const [x, y] = points.reduce(([sx, sy], [px, py]) => [sx + px, sy + py], [0, 0]);
	return [x / points.length, y / points.length];
}

/** Shortest distance in meters from the vertex average of a convex polygon to its sides. */
export function inradius(points: readonly Vec2[]): number {
	const [cx, cy] = centre(points);
	return Math.min(...points.map((_, i) => {
		const { a, normal } = side(points, i);
		return (a[0] - cx) * normal[0] + (a[1] - cy) * normal[1];
	}));
}

/** Moves every side of a convex counterclockwise polygon inward by `distance` meters. */
export function inset(points: readonly Vec2[], distance: number): Vec2[] {
	const n = points.length;
	return points.map((_, i) => {
		const before = side(points, (i + n - 1) % n);
		const after = side(points, i);
		const p = before.at(1, -distance);
		const q = after.at(0, -distance);
		const [d1x, d1y] = [before.b[0] - before.a[0], before.b[1] - before.a[1]];
		const [d2x, d2y] = [after.b[0] - after.a[0], after.b[1] - after.a[1]];
		const cross = d1x * d2y - d1y * d2x;
		if (!cross) return q;
		const t = ((q[0] - p[0]) * d2y - (q[1] - p[1]) * d2x) / cross;
		return [p[0] + d1x * t, p[1] + d1y * t];
	});
}

/** A convex polygon inset by `gap` with corners rounded to `radius`: the polygon inset by
 * gap + radius, grown back by radius along arcs. It stays inside the original polygon. */
export function rounded(points: readonly Vec2[], gap: number, radius: number): Vec2[] {
	const core = inset(points, gap + radius);
	const n = core.length;
	const steps = Math.max(1, Math.round(curveSegments / n));
	return core.flatMap(([x, y], i) => {
		const from = side(points, (i + n - 1) % n).normal;
		const to = side(points, i).normal;
		const a0 = Math.atan2(from[1], from[0]);
		let sweep = Math.atan2(to[1], to[0]) - a0;
		if (sweep < 0) sweep += 2 * Math.PI;
		return Array.from({ length: steps + 1 }, (_, k): Vec2 => {
			const angle = a0 + (sweep * k) / steps;
			return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
		});
	});
}

/** A convex polygon inset by `gap` with each corner cut back by `cut` meters along its sides. */
export function chamfered(points: readonly Vec2[], gap: number, cut: number): Vec2[] {
	const core = inset(points, gap);
	const n = core.length;
	return core.flatMap((point, i) => {
		const toward = (other: Vec2): Vec2 => {
			const [dx, dy] = [other[0] - point[0], other[1] - point[1]];
			const share = Math.min(1 / 2, cut / Math.hypot(dx, dy));
			return [point[0] + dx * share, point[1] + dy * share];
		};
		return [toward(core[(i + n - 1) % n]), toward(core[(i + 1) % n])];
	});
}

const lift = (points: readonly Vec2[], z: number): Vec3[] => points.map(([x, y]) => [x, y, z]);

/** A closed prism between two heights. */
export function extrusion(points: readonly Vec2[], base: number, top: number): Faces {
	const low = lift(points, base);
	const high = lift(points, top);
	const n = points.length;
	return [[...low].reverse(), high, ...points.map((_, i) => [low[i], low[(i + 1) % n], high[(i + 1) % n], high[i]])];
}

/** A closed solid whose rings shrink toward the polygon's centre as `profile(t)` gives
 * [scale, height share] for t from 0 to 1, ending in an apex. */
function lathe(points: readonly Vec2[], base: number, rise: number, rings: number, profile: (t: number) => Vec2): Faces {
	const [cx, cy] = centre(points);
	const ring = (t: number) => {
		const [scale, share] = profile(t);
		return points.map(([x, y]): Vec3 => [cx + (x - cx) * scale, cy + (y - cy) * scale, base + rise * share]);
	};
	const levels = Array.from({ length: rings }, (_, k) => ring(k / rings));
	const apex: Vec3 = [cx, cy, base + rise];
	const n = points.length;
	const faces: Faces = [[...levels[0]].reverse()];
	levels.forEach((low, k) => {
		const high = levels[k + 1];
		for (let i = 0; i < n; i += 1) {
			const j = (i + 1) % n;
			faces.push(high ? [low[i], low[j], high[j], high[i]] : [low[i], low[j], apex]);
		}
	});
	return faces;
}

/** A dome of the given rise over the polygon. */
export function dome(points: readonly Vec2[], base: number, rise: number): Faces {
	return lathe(points, base, rise, domeRings, (t) => [Math.cos((t * Math.PI) / 2), Math.sin((t * Math.PI) / 2)]);
}

/** A cone of the given rise over the polygon. */
export function cone(points: readonly Vec2[], base: number, rise: number): Faces {
	return lathe(points, base, rise, 1, () => [1, 0]);
}

/** A mono-pitch wedge rising away from the polygon's first side. */
export function wedge(points: readonly Vec2[], base: number, rise: number): Faces {
	const { a, normal } = side(points, 0);
	const depth = Math.max(...points.map(([x, y]) => -((x - a[0]) * normal[0] + (y - a[1]) * normal[1])));
	const height = ([x, y]: Vec2) => base + rise * (wedgeLowRatio + (1 - wedgeLowRatio) * (-((x - a[0]) * normal[0] + (y - a[1]) * normal[1]) / depth));
	const low = lift(points, base);
	const high = points.map((point): Vec3 => [point[0], point[1], height(point)]);
	const n = points.length;
	return [[...low].reverse(), high, ...points.map((_, i) => [low[i], low[(i + 1) % n], high[(i + 1) % n], high[i]])];
}

// Exact arithmetic: signed volume of a closed fan-triangulated surface.
function signedVolume(faces: Faces): number {
	let volume = 0;
	for (const face of faces)
		for (let k = 1; k + 1 < face.length; k += 1) {
			const [a, b, c] = [face[0], face[k], face[k + 1]];
			volume += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
		}
	return volume;
}

/** Sweeps a planar outline by an offset into a closed solid wound outward. */
function sweep(outline: readonly Vec3[], offset: Vec3): Faces {
	const far = outline.map((p): Vec3 => [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]]);
	const n = outline.length;
	const faces: Faces = [[...outline].reverse(), far, ...outline.map((_, i) => [outline[i], outline[(i + 1) % n], far[(i + 1) % n], far[i]])];
	return signedVolume(faces) < 0 ? faces.map((face) => [...face].reverse()) : faces;
}

/** A flat figure (circle or polygon of `sides` corners, apex up) of the given radius on a wall
 * plane, extruded `depth` meters across the wall and centred on it. */
export function wallFigure(at: Vec3, along: Vec2, out: Vec2, radius: number, sides: number, depth: number): Faces {
	const outline = Array.from({ length: sides }, (_, k): Vec3 => {
		const angle = Math.PI / 2 + (2 * Math.PI * k) / sides;
		const [u, v] = [radius * Math.cos(angle), radius * Math.sin(angle)];
		return [at[0] + along[0] * u - (out[0] * depth) / 2, at[1] + along[1] * u - (out[1] * depth) / 2, at[2] + v];
	});
	return sweep(outline, [out[0] * depth, out[1] * depth, 0]);
}

/** A square bar of side `thickness` from a to b. */
export function bar(a: Vec3, b: Vec3, thickness: number): Faces {
	const axis: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
	const length = Math.hypot(...axis);
	const d: Vec3 = [axis[0] / length, axis[1] / length, axis[2] / length];
	const helper: Vec3 = Math.abs(d[2]) < 1 / 2 ? [0, 0, 1] : [1, 0, 0];
	const cross = (p: Vec3, q: Vec3): Vec3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
	const raw = cross(helper, d);
	const size = Math.hypot(...raw);
	const v: Vec3 = [raw[0] / size, raw[1] / size, raw[2] / size];
	const w = cross(d, v);
	const corner = (j: number, k: number): Vec3 => [0, 1, 2].map((i) => a[i] + (j - 1 / 2) * thickness * v[i] + (k - 1 / 2) * thickness * w[i]) as unknown as Vec3;
	return sweep([corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)], axis);
}
