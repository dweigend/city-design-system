/**
 * Section: horizontal plane (floor) and vertical plane (a line in plan).
 * Prisms and boxes are cut exactly and receive closed cut faces (poché, 40); lines are
 * clipped; all other forms stay or go depending on their center.
 */
import type { Primitive, Vec3 } from '../parametrik/types';
import { legacyRoleOf } from '../parametrik/types';
import {
	area,
	bounds,
	boxPolygon,
	center,
	chords,
	clipPolygon,
	rotated,
	type HalfPlane,
	type Point2
} from './geometrie';

export type Schnitt = {
	/** Height of the horizontal section plane; what lies below it is kept. */
	hoehe: number | null;
	/** Vertical plane in plan: n·p ≤ d is kept. */
	vertikal: HalfPlane | null;
};
export const keinSchnitt: Schnitt = { hoehe: null, vertikal: null };

/**
 * Vertical plane across an axis at x = lage or y = lage. The side facing the main camera
 * (−x, −y) is cut away: axonometric view and section both look at the cut face.
 */
export const ebene = (achse: 'x' | 'y', lage: number): HalfPlane => ({
	normal: achse === 'x' ? [-1, 0] : [0, -1],
	d: -lage
});

/** Thickness of the cap; it sits on the cut face, toward the side that is cut away. */
export const CAP = 0.04;
const MIN = 0.05;

const sideOf = (h: HalfPlane, x: number, y: number) => h.normal[0] * x + h.normal[1] * y - h.d;

/** Cuts a prism (or a box as a prism): body plus caps. */
function cutSolid(
	p: Primitive,
	polygon: Point2[],
	z: number,
	height: number,
	s: Schnitt
): Primitive[] {
	const top = s.hoehe === null ? z + height : Math.min(z + height, s.hoehe);
	if (top - z < MIN) return [];
	const poly = s.vertikal ? clipPolygon(polygon, s.vertikal) : polygon;
	if (poly.length < 3 || area(poly) < 1e-4) return [];
	const { id, role, token, material, rank, pattern, shade, glass, edges, emphasis } = p;
	const body: Primitive = {
		...{ id, role, token, material, rank, pattern, shade, glass, edges, emphasis },
		kind: 'prism',
		polygon: poly,
		z,
		height: top - z
	};
	const out: Primitive[] = [body];
	// Glass, ghost and pure surfaces without volume get no poché.
	if (p.glass || p.material === 'ghost' || p.material === 'glass') return out;
	const section = legacyRoleOf(p);
	const cap = { role: p.role, token: '--paper', material: 'paper', section, emphasis } as const;
	if (s.hoehe !== null && s.hoehe < z + height && s.hoehe > z)
		out.push({
			...cap,
			id: `${p.id}#schnitt-h`,
			kind: 'prism',
			polygon: poly,
			z: s.hoehe,
			height: CAP
		});
	if (s.vertikal) {
		const [nx, ny] = s.vertikal.normal;
		chords(polygon, s.vertikal).forEach(([a, b], k) => {
			if (Math.hypot(a[0] - b[0], a[1] - b[1]) < MIN) return;
			out.push({
				...cap,
				id: `${p.id}#schnitt-v${k}`,
				kind: 'prism',
				polygon: [a, b, [b[0] + nx * CAP, b[1] + ny * CAP], [a[0] + nx * CAP, a[1] + ny * CAP]],
				z,
				height: top - z
			});
		});
	}
	return out;
}

/** Clips a line: pieces inside both half-spaces; connected runs stay one line. */
function cutLine(p: Extract<Primitive, { kind: 'polyline' }>, s: Schnitt): Primitive[] {
	const pts = p.closed ? [...p.points, p.points[0]] : p.points;
	const runs: Vec3[][] = [];
	let clipped = false;
	const value = (q: Vec3): number[] => [
		...(s.hoehe === null ? [] : [q[2] - s.hoehe]),
		...(s.vertikal ? [sideOf(s.vertikal, q[0], q[1])] : [])
	];
	const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
		a[0] + (b[0] - a[0]) * t,
		a[1] + (b[1] - a[1]) * t,
		a[2] + (b[2] - a[2]) * t
	];
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1],
			b = pts[i],
			va = value(a),
			vb = value(b);
		let t0 = 0,
			t1 = 1;
		for (let k = 0; k < va.length; k++) {
			if (va[k] > 0 && vb[k] > 0) {
				t0 = 1;
				t1 = 0;
				break;
			}
			const t = va[k] / (va[k] - vb[k]);
			if (va[k] > 0) t0 = Math.max(t0, t);
			else if (vb[k] > 0) t1 = Math.min(t1, t);
		}
		if (t0 > 0 || t1 < 1) clipped = true;
		if (t1 - t0 < 1e-6) continue;
		const from = lerp(a, b, t0),
			to = lerp(a, b, t1);
		const run = runs.at(-1);
		const last = run?.at(-1);
		if (
			run &&
			last &&
			t0 === 0 &&
			Math.hypot(last[0] - from[0], last[1] - from[1], last[2] - from[2]) < 1e-6
		)
			run.push(to);
		else runs.push([from, to]);
	}
	if (!clipped) return [p];
	return runs.map((points, k) => ({
		...p,
		id: `${p.id}#k${k}`,
		kind: 'polyline',
		points,
		closed: false
	}));
}

/** Cuts a scene. Without a plane everything stays unchanged. */
export function schneiden(primitives: Primitive[], s: Schnitt): Primitive[] {
	if (s.hoehe === null && !s.vertikal) return primitives;
	const out: Primitive[] = [];
	for (const p of primitives) {
		const b = bounds(p);
		const below = s.hoehe === null || b.max[2] <= s.hoehe + 1e-6;
		const inside =
			!s.vertikal ||
			Math.max(
				sideOf(s.vertikal, b.min[0], b.min[1]),
				sideOf(s.vertikal, b.max[0], b.min[1]),
				sideOf(s.vertikal, b.min[0], b.max[1]),
				sideOf(s.vertikal, b.max[0], b.max[1])
			) <= 1e-6;
		if (below && inside) {
			out.push(p);
			continue;
		}
		if (p.kind === 'polyline') out.push(...cutLine(p, s));
		else if (p.kind === 'prism')
			out.push(...cutSolid(p, rotated(p.polygon, p.rotation ?? 0), p.z, p.height, s));
		else if (p.kind === 'box')
			out.push(
				...cutSolid(p, boxPolygon(p.position, p.size, p.rotation), p.position[2], p.size[2], s)
			);
		else {
			// Other forms: stay if their center lies on the kept side.
			const [x, y, z] = center(b);
			if ((s.hoehe === null || z <= s.hoehe) && (!s.vertikal || sideOf(s.vertikal, x, y) <= 0))
				out.push(p);
		}
	}
	return out;
}
