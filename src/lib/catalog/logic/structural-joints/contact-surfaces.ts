import { FRAME_DIAMETER } from '../../data/frame-sections';
import { isStructural, type Primitive, type Vec3 } from '../parametrik/types';

export const contactToleranceM = 1e-5;
type Point = readonly [number, number];
export type Round = {
	kind: 'round';
	a: Vec3;
	b: Vec3;
	radius: number;
	capped: boolean;
	squash?: number;
};
export type Face = { kind: 'face'; ring: Point[]; holes: Point[][]; z: number; up: number };
export type Surface = Round | Face;

/** Vector from the second point to the first. */
export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** World-space point at the given signed distance along a unit vector. */
export const along = (a: Vec3, axis: Vec3, t: number): Vec3 => [
	a[0] + axis[0] * t,
	a[1] + axis[1] * t,
	a[2] + axis[2] * t
];
/** Scalar projection onto a unit vector. */
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function runs(points: Vec3[], radius: number): Round[] {
	return points.slice(1).flatMap((b, i) => {
		const a = points[i];
		return Math.hypot(...subtract(a, b)) > contactToleranceM
			? [{ kind: 'round', a, b, radius, capped: false }]
			: [];
	});
}

/** Visible axial members, including nominal sections for carriers drawn by their axes. */
export function memberRuns(part: Primitive): Round[] {
	if (part.planned || part.material === 'ghost') return [];
	if (
		part.kind === 'cylinder' &&
		(isStructural(part) || /:stilt|:piloti|:pier$|\/(?:pillar\/\d+|shaft)$/.test(part.id))
	) {
		return runs([part.position, along(part.position, [0, 0, 1], part.height)], part.radius);
	}
	if (part.kind === 'pipe' && isStructural(part)) return runs(part.points, part.radius);
	if (part.kind !== 'polyline' || !isStructural(part)) return [];
	const diameter =
		part.sectionDiameter ??
		(part.member === 'secondary' ? FRAME_DIAMETER.brace : FRAME_DIAMETER.main);
	return runs(part.points, diameter / 2);
}

function planarFaces(p: Primitive): Face[] {
	if (p.kind === 'prism')
		return [1, -1].map((up) => ({
			kind: 'face',
			ring: p.polygon,
			holes: p.holes ?? [],
			z: p.z + (up > 0 ? p.height : 0),
			up
		}));
	if (p.kind !== 'box') return [];
	const [x, y, z] = p.position;
	const [w, d, h] = p.size;
	const c = Math.cos(p.rotation ?? 0),
		s = Math.sin(p.rotation ?? 0);
	const ring = (
		[
			[0, 0],
			[w, 0],
			[w, d],
			[0, d]
		] as const
	).map(([u, v]): Point => {
		const dx = u - w / 2,
			dy = v - d / 2;
		return [x + w / 2 + c * dx - s * dy, y + d / 2 + s * dx + c * dy];
	});
	return [1, -1].map((up) => ({ kind: 'face', ring, holes: [], z: z + (up > 0 ? h : 0), up }));
}

/** Analytic bearing faces supplied by the same primitives used for drawing. */
export function contactSurfaces(p: Primitive, members: Round[]): Surface[] {
	if (p.planned || p.material === 'ghost') return [];
	if (p.kind === 'pipe') return runs(p.points, p.radius);
	if (p.kind === 'capsule')
		return runs([p.from, p.to], p.radius).map((run) => ({ ...run, capped: true }));
	if (p.kind === 'sphere')
		return [
			{
				kind: 'round',
				a: p.position,
				b: p.position,
				radius: p.radius,
				capped: true,
				squash: p.squash
			}
		];
	if (p.kind === 'cylinder')
		return runs([p.position, along(p.position, [0, 0, 1], p.height)], p.radius);
	return members.length ? members : planarFaces(p);
}

function inside(ring: Point[], [x, y]: Vec3) {
	let contained = false;
	for (let i = 0; i < ring.length; i++) {
		const [ax, ay] = ring[i],
			[bx, by] = ring[(i + 1) % ring.length];
		const turn = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
		if (
			Math.abs(turn) < contactToleranceM &&
			x >= Math.min(ax, bx) - contactToleranceM &&
			x <= Math.max(ax, bx) + contactToleranceM &&
			y >= Math.min(ay, by) - contactToleranceM &&
			y <= Math.max(ay, by) + contactToleranceM
		)
			return true;
		if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) contained = !contained;
	}
	return contained;
}

/** Tests the horizontal bearing footprint, respecting open courtyards. */
export function onFace(face: Face, point: Vec3) {
	return inside(face.ring, point) && !face.holes.some((hole) => inside(hole, point));
}

/** Plan bounds of a bearing face or tube, for indexing possible contacts. */
export function surfaceBounds(surface: Surface) {
	const points = surface.kind === 'round' ? [surface.a, surface.b] : surface.ring;
	const radius = surface.kind === 'round' ? surface.radius : 0;
	let x0 = Infinity,
		y0 = Infinity,
		x1 = -Infinity,
		y1 = -Infinity;
	for (const [x, y] of points) {
		x0 = Math.min(x, x0);
		y0 = Math.min(y, y0);
		x1 = Math.max(x, x1);
		y1 = Math.max(y, y1);
	}
	return [x0 - radius, y0 - radius, x1 + radius, y1 + radius];
}
