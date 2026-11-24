import { distance, type Vec2 } from '../../core/geometry';
import type { Part } from '../../core/object';
import { defaults } from '../../../config/house-court';
import type { FineCell } from '../cell-space';
import { boxMesh, side, type Box } from './boxes';
import type { HouseCell } from './occupancy';
import type { Context } from './context';

const {
	galleryComplexityRatio,
	galleryDepthM,
	galleryThicknessM,
	railingHeightM,
	railingThicknessM,
	stairRiserM,
	stairWidthM
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
			return (bx - ax) * (py - ay) - (by - ay) * (px - ax) >= -Number.EPSILON * (Math.abs(px) + Math.abs(py) + 1);
		})
	);
}

/** True when a strip `depth` meters deep along the court side lies inside the court cell. */
function fits(context: Context, { cell, index }: CourtSide, depth: number): boolean {
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

/** The court side the stair runs along: nearest the entrance, with room for gallery and stair. */
export function stairSide(context: Context, sides: readonly CourtSide[], entrance: Vec2 | undefined): CourtSide | undefined {
	if (!entrance) return undefined;
	const near = (s: CourtSide) => distance(side(s.cell.quad, s.index).at(1 / 2, 0), entrance);
	return [...sides].filter((s) => fits(context, s, galleryDepthM + stairWidthM)).sort((a, b) => near(a) - near(b))[0];
}

function galleryBoxes(context: Context, { cell, house, index }: CourtSide, landing: boolean): Box[] {
	const wall = side(cell.quad, index);
	const first = Math.max(1, house.fromStorey);
	const [mx, my] = wall.at(1 / 2, galleryDepthM / 2);
	const open = landing ? Math.min(stairWidthM, wall.length) / wall.length : 0;
	const { baseZ, storeyHeightM } = context.space;
	return Array.from({ length: house.toStorey - first }, (_, k) => {
		const z = baseZ + (first + k) * storeyHeightM;
		const gap = k === 0 ? open : 0;
		const [rx, ry] = wall.at((1 - gap) / 2, galleryDepthM - railingThicknessM / 2);
		return [
			{ center: [mx, my, z - galleryThicknessM / 2], size: [wall.length, galleryDepthM, galleryThicknessM], rotation: wall.rotation },
			{ center: [rx, ry, z + railingHeightM / 2], size: [wall.length * (1 - gap), railingThicknessM, railingHeightM], rotation: wall.rotation }
		] satisfies Box[];
	}).flat();
}

/** Galleries along every court side, one mesh part per side, in cell order; the railing opens at
 * the stair landing. */
export function galleries(context: Context, sides: readonly CourtSide[], landing?: CourtSide): Part[] {
	return sides.flatMap((courtSide) => {
		const shape = boxMesh(galleryBoxes(context, courtSide, courtSide === landing));
		return shape ? [{ id: `${courtSide.cell.id}/gallery/${courtSide.index}`, slot: 'gallery', shape }] : [];
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
		const [x, y] = wall.at((k + 1 / 2) / steps, galleryDepthM + stairWidthM / 2);
		const top = ((k + 1) / steps) * rise;
		return { center: [x, y, context.space.baseZ + top / 2], size: [wall.length / steps, stairWidthM, top], rotation: wall.rotation };
	});
	const shape = boxMesh(boxes);
	return shape ? [{ id: `${chosen.cell.id}/stair`, slot: 'stair', shape }] : [];
}
