import { distance, type Vec2 } from '../../core/geometry';
import type { Part } from '../../core/object';
import { defaults } from '../../../config/house-court';
import type { FineCell } from '../cell-space';
import { boxMesh, faceMesh, side, type Box } from './boxes';
import { extrusion } from './solids';
import type { HouseCell } from './occupancy';
import type { Context } from './context';

const {
	galleryComplexityRatio,
	galleryDepthM,
	galleryThicknessM,
	railingHeightM,
	railingThicknessM,
	stairRiserM,
	courtStairWidthM,
	entranceStepRiseM,
	entranceStairWidthM,
	entranceStepGoingM,
	plotThicknessM
} = defaults;

type CourtSide = Readonly<{ cell: FineCell; house: HouseCell; index: number }>;

const courtCell = (context: Context, id: string | null) => {
	const cell = id === null ? undefined : context.space.cells.find((c) => c.id === id);
	return cell && context.occupancy.get(cell.id)?.role === 'court' ? cell : undefined;
};

/** True when every point lies inside the convex counterclockwise quad. */
function inside(quad: readonly Vec2[], points: readonly Vec2[]): boolean {
	return points.every(([px, py]) =>
		quad.every(([ax, ay], i) => {
			const [bx, by] = quad[(i + 1) % quad.length];
			return (
				(bx - ax) * (py - ay) - (by - ay) * (px - ax) >=
				-Number.EPSILON * (Math.abs(px) + Math.abs(py) + 1)
			);
		})
	);
}

/** True when a strip `depth` meters deep along the court side lies inside the court cell, or the
 * side is a parcel edge onto a shared court, where the strip stands on public court ground. */
function fits(context: Context, { cell, index }: CourtSide, depth: number): boolean {
	if (cell.sides[index].court) return true;
	const court = courtCell(context, cell.sides[index].neighbour);
	const wall = side(cell.quad, index);
	return !!court && inside(court.quad, [wall.at(0, depth), wall.at(1, depth)]);
}

/** Sides of built cells at least two storeys tall that face the court and have room for a gallery. */
export function courtSides(context: Context, complexity: number): CourtSide[] {
	if (complexity < galleryComplexityRatio) return [];
	return context.space.cells.flatMap((cell) => {
		const house = context.occupancy.get(cell.id);
		if (!house || house.toStorey <= 1) return [];
		return cell.sides.flatMap((_, index) => {
			const courtSide = { cell, house, index };
			return fits(context, courtSide, galleryDepthM) ? [courtSide] : [];
		});
	});
}

/** The court side the stair runs along: nearest the entrance (for a shared court, the longest
 * side onto it), with room for gallery and stair. */
export function stairSide(
	context: Context,
	sides: readonly CourtSide[],
	entrance: Vec2 | undefined
): CourtSide | undefined {
	const shared = sides.filter(({ cell, index }) => cell.sides[index].court);
	if (shared.length)
		return [...shared].sort(
			(a, b) => side(b.cell.quad, b.index).length - side(a.cell.quad, a.index).length
		)[0];
	if (!entrance) return undefined;
	const near = (s: CourtSide) => distance(side(s.cell.quad, s.index).at(1 / 2, 0), entrance);
	return [...sides]
		.filter((s) => fits(context, s, galleryDepthM + courtStairWidthM))
		.sort((a, b) => near(a) - near(b))[0];
}

function galleryBoxes(
	context: Context,
	{ cell, house, index }: CourtSide,
	landing: boolean
): Box[] {
	const wall = side(cell.quad, index);
	const first = Math.max(1, house.fromStorey);
	const [mx, my] = wall.at(1 / 2, galleryDepthM / 2);
	const open = landing ? Math.min(courtStairWidthM, wall.length) / wall.length : 0;
	const { baseZ, storeyHeightM } = context.space;
	return Array.from({ length: house.toStorey - first }, (_, k) => {
		const z = baseZ + (first + k) * storeyHeightM;
		const gap = k === 0 ? open : 0;
		const [rx, ry] = wall.at((1 - gap) / 2, galleryDepthM - railingThicknessM / 2);
		return [
			{
				center: [mx, my, z - galleryThicknessM / 2],
				size: [wall.length, galleryDepthM, galleryThicknessM],
				rotation: wall.rotation
			},
			{
				center: [rx, ry, z + railingHeightM / 2],
				size: [wall.length * (1 - gap), railingThicknessM, railingHeightM],
				rotation: wall.rotation
			}
		] satisfies Box[];
	}).flat();
}

/** Galleries along every court side, one mesh part per side, in cell order; the railing opens at
 * the stair landing. */
export function galleries(
	context: Context,
	sides: readonly CourtSide[],
	landing?: CourtSide
): Part[] {
	return sides.flatMap((courtSide) => {
		const shape = boxMesh(galleryBoxes(context, courtSide, courtSide === landing));
		return shape
			? [{ id: `${courtSide.cell.id}/gallery/${courtSide.index}`, slot: 'gallery', shape }]
			: [];
	});
}

/** One straight stair from the court floor to the first gallery beside the chosen side, rising
 * toward the side's end where the railing opens, as one stepped mesh part. */
// Exact arithmetic: stair steps are whole counts.
export function stair(context: Context, chosen: CourtSide | undefined): Part[] {
	if (!chosen) return [];
	const wall = side(chosen.cell.quad, chosen.index);
	const rise = Math.max(1, chosen.house.fromStorey) * context.space.storeyHeightM;
	const steps = Math.ceil(rise / stairRiserM);
	const boxes = Array.from({ length: steps }, (_, k): Box => {
		const [x, y] = wall.at((k + 1 / 2) / steps, galleryDepthM + courtStairWidthM / 2);
		const top = ((k + 1) / steps) * rise;
		return {
			center: [x, y, context.space.baseZ + top / 2],
			size: [wall.length / steps, courtStairWidthM, top],
			rotation: wall.rotation
		};
	});
	const shape = boxMesh(boxes);
	return shape ? [{ id: `${chosen.cell.id}/stair`, slot: 'stair', shape }] : [];
}

/** Keeps the part of a convex polygon where `keep` is not negative (a half-plane for a linear
 * `keep`). */
function clipBy(polygon: readonly Vec2[], keep: (point: Vec2) => number): Vec2[] {
	const result: Vec2[] = [];
	polygon.forEach((p, i) => {
		const q = polygon[(i + 1) % polygon.length];
		const [dp, dq] = [keep(p), keep(q)];
		if (dp >= 0) result.push(p);
		if (dp * dq < 0) {
			const t = dp / (dp - dq);
			result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
		}
	});
	return result;
}

/** The entrance cell and its frontage side when the site's rise needs steps, else undefined. */
export function entranceStepCell(
	context: Pick<Context, 'space' | 'occupancy' | 'house'>
): { cell: FineCell; index: number } | undefined {
	const { house } = context;
	if (house.site.entranceRiseM <= entranceStepRiseM) return undefined;
	const id = house.entrances[0]?.[0];
	const cell = context.space.cells.find((c) => c.id === id);
	const index = cell?.sides.findIndex(({ frontage }) => frontage) ?? -1;
	const role = cell ? context.occupancy.get(cell.id)?.role : undefined;
	if (!cell || index < 0 || role === 'wing') return undefined;
	return { cell, index };
}

/** The entrance cell's ground split around the steps: the step treads (front to back) and the
 * rest of the cell. The steps are the entrance stair width wide, centred on the frontage side, and
 * one going per riser deep, at most the cell's depth. */
// Exact arithmetic: stair steps are whole counts, halves centre the stair.
export function entranceGround(context: Pick<Context, 'space' | 'occupancy' | 'house'>) {
	const entry = entranceStepCell(context);
	if (!entry) return undefined;
	const { cell, index } = entry;
	const wall = side(cell.quad, index);
	const inward = ([x, y]: Vec2) =>
		-((x - wall.a[0]) * wall.normal[0] + (y - wall.a[1]) * wall.normal[1]);
	const [ux, uy] = [(wall.b[0] - wall.a[0]) / wall.length, (wall.b[1] - wall.a[1]) / wall.length];
	const lateral = ([x, y]: Vec2) => (x - wall.a[0]) * ux + (y - wall.a[1]) * uy - wall.length / 2;
	const depth = Math.max(...cell.quad.map(inward));
	const steps = Math.ceil(context.house.site.entranceRiseM / stairRiserM);
	const run = Math.min(depth, steps * entranceStepGoingM);
	const half = Math.min(entranceStairWidthM, wall.length) / 2;
	const front = clipBy(cell.quad, (p) => run - inward(p));
	const stairZone = clipBy(
		clipBy(front, (p) => half - lateral(p)),
		(p) => half + lateral(p)
	);
	const treads = Array.from({ length: steps }, (_, k) =>
		clipBy(
			clipBy(stairZone, (p) => inward(p) - (k * run) / steps),
			(p) => ((k + 1) * run) / steps - inward(p)
		)
	);
	const rest = [
		clipBy(cell.quad, (p) => inward(p) - run),
		clipBy(front, (p) => -half - lateral(p)),
		clipBy(front, (p) => lateral(p) - half)
	].filter((piece) => piece.length >= 3);
	return { cell, treads, rest };
}

/** Steps from the lane up to the ground storey inside the open entrance cell: the rise split into
 * risers no higher than the stair riser, each tread a prism from the ground under the parcel (or a
 * plot plate below the lane) to its height. One mesh part in the given slot. */
// Exact arithmetic: stair steps are whole counts.
export function entranceSteps(context: Context, slot: string): Part[] {
	const ground = entranceGround(context);
	if (!ground) return [];
	const rise = context.house.site.entranceRiseM;
	const lane = context.space.baseZ - rise;
	const base = Math.min(context.house.site.groundZ ?? Infinity, lane - plotThicknessM);
	const steps = ground.treads.length;
	const faces = ground.treads.flatMap((outline, k) =>
		outline.length >= 3 ? extrusion(outline, base, lane + ((k + 1) * rise) / steps) : []
	);
	const shape = faceMesh(faces);
	return shape ? [{ id: `${ground.cell.id}/steps`, slot, shape }] : [];
}
