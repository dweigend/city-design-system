import type { Vec3 } from '../parametrik/types';
import { cellAtPoint, MODULE, type TerrainGrid } from '../terrain-grid';
import type { StructuralContact } from './index';
import {
	along,
	contactToleranceM,
	dot,
	onFace,
	subtract,
	type Round,
	type Surface
} from './contact-surfaces';

export type End = { point: Vec3; axis: Vec3; length: number };
type Seat = Pick<StructuralContact, 'point' | 'seat' | 'supportNormal' | 'supportProfile'> & {
	diameter: number;
};

function plane(end: End, point: Vec3, normal: Vec3) {
	const rise = dot(normal, end.axis);
	if (rise < 1 / 8) return;
	const t = dot(normal, subtract(point, end.point)) / rise;
	return { t, point: along(end.point, end.axis, t), normal };
}

function faceSeat(end: End, face: Extract<Surface, { kind: 'face' }>, diameter: number) {
	const hit = plane(end, [0, 0, face.z], [0, 0, face.up]);
	if (!hit || Math.abs(hit.t) > contactToleranceM || !onFace(face, hit.point)) return;
	return {
		seat: face.up > 0 ? 'wall-crest' : 'block-transition',
		point: hit.point,
		supportNormal: hit.normal,
		supportProfile: { kind: 'plane' },
		diameter
	} satisfies Seat;
}

function roundHit(end: End, center: Vec3, direction: Vec3, radius: number, squash = 1) {
	const offset = subtract(end.point, center);
	const origin = along(offset, direction, -dot(offset, direction));
	const ray = along(end.axis, direction, -dot(end.axis, direction));
	const scaleZ = ([x, y, z]: Vec3): Vec3 => [x, y, z / squash];
	const u = scaleZ(origin),
		v = scaleZ(ray);
	const a = dot(v, v),
		b = dot(u, v);
	const disc = b * b - a * (dot(u, u) - radius * radius);
	if (a <= 0 || disc < -(contactToleranceM ** 2)) return;
	const root = Math.sqrt(Math.max(0, disc));
	if ((-b - root) / a > contactToleranceM) return;
	const t = (-b + root) / a;
	if (t < -contactToleranceM || t >= end.length) return;
	const gradient = scaleZ(along(u, v, t));
	const magnitude = Math.hypot(...gradient);
	const normal = gradient.map((n) => n / magnitude) as Vec3;
	if (dot(normal, end.axis) < 1 / 8 + 1e-8) return;
	return { point: along(end.point, end.axis, t), normal };
}

function endCap(end: End, surface: Round, direction: Vec3) {
	const { a, b, radius, capped, squash } = surface;
	for (const [point, sign] of [
		[a, -1],
		[b, 1]
	] as const) {
		const normal = along([0, 0, 0], direction, sign);
		if (capped) {
			const hit = roundHit(end, point, [0, 0, 0], radius, squash);
			if (hit && dot(subtract(hit.point, point), normal) >= -contactToleranceM)
				return {
					seat: 'frame-corner',
					point: hit.point,
					supportNormal: hit.normal,
					supportProfile: { kind: 'plane' },
					diameter: radius * 2
				} satisfies Seat;
			continue;
		}
		const hit = plane(end, point, normal);
		if (
			hit &&
			Math.abs(hit.t) <= contactToleranceM &&
			Math.hypot(...subtract(point, hit.point)) <= radius + contactToleranceM
		)
			return {
				seat: 'block-transition',
				point: hit.point,
				supportNormal: normal,
				supportProfile: { kind: 'plane' },
				diameter: radius * 2
			} satisfies Seat;
	}
}

function roundSeat(end: End, surface: Round, rail: boolean): Seat | undefined {
	const { a, b, radius } = surface;
	const span = subtract(b, a),
		length = Math.hypot(...span);
	const direction = span.map((n) => (length ? n / length : 0)) as Vec3;
	const hit = length ? roundHit(end, a, direction, radius) : undefined;
	if (hit) {
		const at = dot(subtract(hit.point, a), direction);
		if (at >= -contactToleranceM && at <= length + contactToleranceM)
			return {
				seat: rail ? 'rail-saddle' : 'chord',
				point: hit.point,
				supportNormal: hit.normal,
				supportProfile: { kind: 'round', axis: direction },
				diameter: radius * 2
			};
	}
	return endCap(end, surface, direction);
}

/** Survey the point where a member leaves one neighbouring surface. */
export function surveySeat(end: End, support: Surface, diameter: number, rail: boolean) {
	return support.kind === 'face' ? faceSeat(end, support, diameter) : roundSeat(end, support, rail);
}

function triangle(end: End, a: Vec3, b: Vec3, c: Vec3) {
	const [x, y, z] = subtract(b, a),
		[u, v, w] = subtract(c, a);
	const normal: Vec3 = [y * w - z * v, z * u - x * w, x * v - y * u];
	const magnitude = Math.hypot(...normal);
	if (!magnitude) return;
	const hit = plane(end, a, normal.map((n) => n / magnitude) as Vec3);
	if (!hit || hit.t < -contactToleranceM || hit.t >= end.length) return;
	if (
		!onFace(
			{ kind: 'face', ring: [a, b, c].map(([x, y]) => [x, y]), holes: [], z: 0, up: 1 },
			hit.point
		)
	)
		return;
	return hit;
}

/** Survey the same two terrain triangles as the stage's ground surface. */
export function surveyGround(grid: TerrainGrid, end: End) {
	const cell = cellAtPoint(grid, end.point[0], end.point[1]);
	if (!cell) return;
	const [a, b, c, d] = cell.corners;
	const hit = triangle(end, a, b, c) ?? triangle(end, a, c, d);
	if (hit)
		return {
			id: 'terrain/' + cell.id,
			seat: 'terrain',
			point: hit.point,
			supportNormal: hit.normal,
			diameter: MODULE
		} satisfies Seat & { id: string };
}
