import type { Vec2, Vec3 } from '../../core/geometry';
import { readStoreyElevation, type FineCell } from '../cell-space';
import { side } from './boxes';
import { builtAt, type Context } from './context';
import type { CellSolid } from './fills';
import { openingRects, openingStoreys } from './parts';
import { defaults } from '../../../config/house-court';
import { exposedWall, fitsOpening, type WallRect } from './wall-contact';

const { faceToleranceM } = defaults;

/** A planar face of the house that a surface family can clad: an origin, a unit `across` axis
 * along the face, a unit outward `normal` (up is normal × across), the size in meters, an optional
 * convex counterclockwise outline in face meters, and window openings as [u0, v0, u1, v1]
 * rectangles. `slot` is the role slot of the part the face belongs to; `place` tells walls from
 * roofs; `body` names the body the face belongs to, so a pattern can wrap all faces of one body. */
export type HouseFace = Readonly<{
	slot: string;
	body: string;
	place: 'wall' | 'roof';
	origin: Vec3;
	across: Vec3;
	normal: Vec3;
	size: Vec2;
	outline?: readonly Vec2[];
	openings: readonly (readonly [number, number, number, number])[];
}>;

const level = ({ space }: Context, storey: number) => readStoreyElevation(space, storey);

// Exact arithmetic: horizontal axes and the run's base.
function wallFace(
	slot: string,
	body: string,
	[a, b]: readonly [Vec2, Vec2],
	z0: number,
	z1: number,
	openings: HouseFace['openings'] = []
): HouseFace | undefined {
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	if (!(length > 0) || !(z1 > z0)) return undefined;
	const [dx, dy] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
	return /* Exact arithmetic: XY wall basis has no vertical component. */ {
		slot,
		body,
		place: 'wall',
		origin: [a[0], a[1], z0],
		across: [dx, dy, 0],
		normal: [dy, -dx, 0],
		size: [length, z1 - z0],
		openings
	};
}

function wallFaces(
	ctx: Context,
	slot: string,
	body: string,
	wall: ReturnType<typeof side>,
	bottom: number,
	top: number,
	openings: readonly WallRect[] = []
): HouseFace[] {
	return exposedWall(ctx.adjoiningWalls, wall, bottom, top).flatMap((rect) => {
		const [u0, z0, u1, z1] = rect;
		const cuts = openings
			.filter((opening) => fitsOpening([rect], opening))
			.map(([l, b, r, t]) => [l - u0, b - z0, r - u0, t - z0] as const);
		const face = wallFace(
			slot,
			body,
			[wall.at(u0 / wall.length, 0), wall.at(u1 / wall.length, 0)],
			z0,
			z1,
			cuts
		);
		return face ? [face] : [];
	});
}

const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const unit = (a: Vec3): Vec3 => {
	const length = Math.hypot(...a);
	return [a[0] / length, a[1] / length, a[2] / length];
};

/** A planar roof face over a convex ring of points, with its first side as the across axis. */
// Exact arithmetic: Newell normal and the outline's bounding origin.
export function roofFace(slot: string, body: string, ring: readonly Vec3[]): HouseFace | undefined {
	if (ring.length < 3) return undefined;
	const newell = ring.reduce<Vec3>(
		(sum, p, i) => {
			const q = ring[(i + 1) % ring.length];
			return [
				sum[0] + (p[1] - q[1]) * (p[2] + q[2]),
				sum[1] + (p[2] - q[2]) * (p[0] + q[0]),
				sum[2] + (p[0] - q[0]) * (p[1] + q[1])
			];
		},
		/* Exact arithmetic: initial sum of XYZ coordinates. */ [0, 0, 0]
	);
	if (!(Math.hypot(...newell) > 0) || newell[2] <= 0) return undefined;
	const normal = unit(newell);
	const edge = subtract(ring[1], ring[0]);
	const along = dot(edge, normal);
	const flat = subtract(edge, [normal[0] * along, normal[1] * along, normal[2] * along]);
	if (!(Math.hypot(...flat) > 0)) return undefined;
	const across = unit(flat);
	const up = cross(normal, across);
	const local = ring.map((p): Vec2 => [
		dot(subtract(p, ring[0]), across),
		dot(subtract(p, ring[0]), up)
	]);
	const [u0, v0] = [Math.min(...local.map(([u]) => u)), Math.min(...local.map(([, v]) => v))];
	const outline = local.map(([u, v]): Vec2 => [u - u0, v - v0]);
	const size: Vec2 = [Math.max(...outline.map(([u]) => u)), Math.max(...outline.map(([, v]) => v))];
	if (!(size[0] > 0 && size[1] > 0)) return undefined;
	const origin: Vec3 = /* Exact arithmetic: XYZ coordinate indices. */ [0, 1, 2].map(
		(k) => ring[0][k] + across[k] * u0 + up[k] * v0
	) as unknown as Vec3;
	return { slot, body, place: 'roof', origin, across, normal, size, outline, openings: [] };
}

/** True when a side of a solid's outline lies on a cell side hidden by another body for the whole
 * run by another built cell of the same house. */
function hidden(ctx: Context, s: CellSolid, [a, b]: readonly [Vec2, Vec2]): boolean {
	const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	return s.cell.sides.some(({ neighbour }, i) => {
		const wall = side(s.cell.quad, i);
		const offset = (mid[0] - wall.a[0]) * wall.normal[0] + (mid[1] - wall.a[1]) * wall.normal[1];
		if (Math.abs(offset) > faceToleranceM) return false;
		if (neighbour === null) return false;
		for (let storey = s.fromStorey; storey < s.toStorey; storey += 1)
			if (!builtAt(ctx, neighbour, storey)) return false;
		return true;
	});
}

/** Wall faces of the flat-sided solids (blocks and chamfers), one per outline side over the run,
 * without the sides another body hides; their figure openings stay drawn in front. Roof faces: the
 * planar tops of wedge roofs and the flat top of every flat-sided solid without a roof solid. */
export function solidFaces(ctx: Context, solids: readonly CellSolid[]): HouseFace[] {
	const roofed = new Set(
		solids.filter(({ key }) => key.endsWith('/roof')).map(({ cell }) => cell.id)
	);
	const tops = new Map<string, CellSolid>();
	for (const s of solids) if (!s.key.endsWith('/roof') && s.flat) tops.set(s.cell.id, s);
	return solids
		.flatMap((s): (HouseFace | undefined)[] => {
			if (s.key.endsWith('/roof'))
				return s.roofKind === 'wedge' ? [roofFace(s.slot, s.key, s.faces[1])] : [];
			if (!s.flat) return [];
			const z0 = level(ctx, s.fromStorey);
			const z1 = level(ctx, s.toStorey);
			const walls = s.outline.flatMap((a, i) => {
				const wall = side(s.outline, i);
				return hidden(ctx, s, [a, wall.b]) ? [] : wallFaces(ctx, s.slot, s.key, wall, z0, z1);
			});
			const top =
				tops.get(s.cell.id) === s && !roofed.has(s.cell.id)
					? [
							roofFace(
								s.slot,
								s.key,
								s.outline.map(([x, y]): Vec3 => [x, y, z1])
							)
						]
					: [];
			return [...walls, ...top];
		})
		.filter((face): face is HouseFace => face !== undefined);
}

/** Runs of storeys over which one cell side is exposed, as [from, to). */
function exposedRuns(ctx: Context, cell: FineCell, i: number, from: number, to: number) {
	const runs: [number, number][] = [];
	for (let storey = from; storey < to; storey += 1) {
		if (builtAt(ctx, cell.sides[i].neighbour, storey)) continue;
		const last = runs.at(-1);
		if (last && last[1] === storey) last[1] = storey + 1;
		else runs.push([storey, storey + 1]);
	}
	return runs;
}

/** Wall faces of the merged envelope, one per exposed cell side and storey run with the window
 * openings of its storeys cut, and the flat top of every built run without a roof solid as a roof
 * face. */
export function envelopeFaces(
	ctx: Context,
	slot: string,
	solids: readonly CellSolid[]
): HouseFace[] {
	const roofed = new Set(
		solids.filter(({ key }) => key.endsWith('/roof')).map(({ cell }) => cell.id)
	);
	return ctx.space.cells.flatMap((cell) => {
		const house = ctx.occupancy.get(cell.id);
		if (!house || house.toStorey <= house.fromStorey) return [];
		const walls = cell.quad.flatMap((_, i) =>
			exposedRuns(ctx, cell, i, house.fromStorey, house.toStorey).flatMap(([from, to]) => {
				const openings = Array.from(
					{ length: Math.max(0, Math.min(to, openingStoreys(ctx, house)) - from) },
					(_, k) => openingRects(ctx, cell, i, from + k)
				).flat();
				return wallFaces(
					ctx,
					slot,
					'envelope',
					side(cell.quad, i),
					level(ctx, from),
					level(ctx, to),
					openings
				);
			})
		);
		const top = roofed.has(cell.id)
			? undefined
			: roofFace(
					slot,
					'envelope',
					cell.quad.map(([x, y]): Vec3 => [x, y, level(ctx, house.toStorey)])
				);
		return [...walls, top].filter((face): face is HouseFace => face !== undefined);
	});
}
