import { distance, type Vec2 } from '../../core/geometry';
import type { Part } from '../../core/object';
import { defaults } from '../../../config/house-court';
import type { FineCell } from '../cell-space';
import { boxMesh, side, type Box } from './boxes';
import type { HouseCell } from './occupancy';
import type { Context } from './parts';

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

const isCourt = (context: Context, id: string | null) =>
	id !== null && context.occupancy.get(id)?.role === 'court';

/** Sides of built cells that face the court and stand at least two storeys tall. */
export function courtSides(context: Context, complexity: number): CourtSide[] {
	if (complexity < galleryComplexityRatio) return [];
	return context.space.cells.flatMap((cell) => {
		const house = context.occupancy.get(cell.id);
		if (!house || house.toStorey <= 1) return [];
		return cell.sides.flatMap(({ neighbour }, index) =>
			isCourt(context, neighbour) ? [{ cell, house, index }] : []
		);
	});
}

function galleryBoxes(context: Context, { cell, house, index }: CourtSide): Box[] {
	const wall = side(cell.quad, index);
	const [mx, my] = wall.at(1 / 2, galleryDepthM / 2);
	const [rx, ry] = wall.at(1 / 2, galleryDepthM - railingThicknessM / 2);
	const { baseZ, storeyHeightM } = context.space;
	return Array.from({ length: house.toStorey - Math.max(1, house.fromStorey) }, (_, k) => {
		const z = baseZ + (Math.max(1, house.fromStorey) + k) * storeyHeightM;
		return [
			{
				center: [mx, my, z - galleryThicknessM / 2],
				size: [wall.length, galleryDepthM, galleryThicknessM],
				rotation: wall.rotation
			},
			{
				center: [rx, ry, z + railingHeightM / 2],
				size: [wall.length, railingThicknessM, railingHeightM],
				rotation: wall.rotation
			}
		] satisfies Box[];
	}).flat();
}

/** Galleries along every court side, one mesh part per side, in cell order. */
export function galleries(context: Context, sides: readonly CourtSide[]): Part[] {
	return sides.flatMap((courtSide) => {
		const shape = boxMesh(galleryBoxes(context, courtSide));
		return shape
			? [{ id: `${courtSide.cell.id}/gallery/${courtSide.index}`, slot: 'gallery', shape }]
			: [];
	});
}

/** One straight stair from the court floor to the first gallery, beside the court side nearest
 * the entrance point, as one stepped mesh part. */
export function stair(
	context: Context,
	sides: readonly CourtSide[],
	entrance: Vec2 | undefined
): Part[] {
	if (!sides.length || !entrance) return [];
	const near = (s: CourtSide) => distance(side(s.cell.quad, s.index).at(0.5, 0), entrance);
	const [chosen] = [...sides].sort((a, b) => near(a) - near(b));
	const wall = side(chosen.cell.quad, chosen.index);
	const rise = context.space.storeyHeightM;
	const steps = Math.ceil(rise / stairRiserM);
	const boxes = Array.from({ length: steps }, (_, k): Box => {
		const [x, y] = wall.at((k + 0.5) / steps, galleryDepthM + stairWidthM / 2);
		const top = ((k + 1) / steps) * rise;
		return {
			center: [x, y, context.space.baseZ + top / 2],
			size: [wall.length / steps, stairWidthM, top],
			rotation: wall.rotation
		};
	});
	const shape = boxMesh(boxes);
	return shape ? [{ id: `${chosen.cell.id}/stair`, slot: 'stair', shape }] : [];
}
