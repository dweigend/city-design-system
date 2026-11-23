import type { Vec2 } from '../../core/geometry';
import type { Part } from '../../core/object';
import { defaults } from '../../../config/house-court';
import type { CellSpace, FineCell } from '../cell-space';
import { boxMesh, offsetQuad, side, type Box } from './boxes';
import type { HouseCell } from './occupancy';

const {
	floorEdgeOutsetM,
	floorEdgeThicknessM,
	roofEdgeOutsetM,
	roofEdgeThicknessM,
	windowPitchM,
	windowWidthM,
	windowHeightM,
	windowSillM,
	groundOpeningHeightM,
	openingDepthM,
	plotThicknessM,
	courtRaiseM
} = defaults;

/** Reads occupancy and geometry of one cell in a fixed space and house. */
export type Context = Readonly<{
	space: CellSpace;
	occupancy: ReadonlyMap<string, HouseCell>;
}>;

/** True when a cell holds closed volume in the given storey. */
export function builtAt(context: Context, id: string | null, storey: number): boolean {
	const cell = id === null ? undefined : context.occupancy.get(id);
	return !!cell && storey >= cell.fromStorey && storey < cell.toStorey;
}

const exposed = (context: Context, cell: FineCell, i: number, storey: number) =>
	!builtAt(context, cell.sides[i].neighbour, storey);

const level = ({ space }: Context, storey: number) => space.baseZ + storey * space.storeyHeightM;

function band(context: Context, cell: FineCell, storey: number, outset: number, thickness: number) {
	const outsets = cell.quad.map((_, i) =>
		exposed(context, cell, i, storey - 1) || exposed(context, cell, i, storey) ? outset : 0
	);
	const z = level(context, storey);
	return {
		kind: 'prism',
		polygon: offsetQuad(cell.quad, outsets),
		base: z - thickness / 2,
		top: z + thickness / 2
	} as const;
}

/** Ground plate of a cell below the parcel ground, or the raised court plate. */
export function plate(context: Context, cell: FineCell, court: boolean): Part {
	const z = context.space.baseZ;
	return court
		? {
				id: `${cell.id}/court`,
				slot: 'court',
				shape: { kind: 'prism', polygon: cell.quad, base: z, top: z + courtRaiseM }
			}
		: {
				id: `${cell.id}/plot`,
				slot: 'plot',
				shape: { kind: 'prism', polygon: cell.quad, base: z - plotThicknessM, top: z }
			};
}

/** The closed volume of a built cell in the given slot. */
export function body(context: Context, cell: FineCell, house: HouseCell, slot: string): Part {
	const shape = {
		kind: 'prism',
		polygon: cell.quad,
		base: level(context, house.fromStorey),
		top: level(context, house.toStorey)
	} as const;
	return { id: `${cell.id}/${slot}`, slot, shape };
}

/** Floor-edge bands at inner storey lines and above a gate, then the roof edge slab. */
export function edges(context: Context, cell: FineCell, house: HouseCell): Part[] {
	const lines = Array.from(
		{ length: house.toStorey - house.fromStorey },
		(_, k) => house.fromStorey + k
	).filter((storey) => storey > 0);
	return [
		...lines.map((storey) => ({
			id: `${cell.id}/floor-edge/${storey}`,
			slot: 'floorEdge',
			shape: band(context, cell, storey, floorEdgeOutsetM, floorEdgeThicknessM)
		})),
		{
			id: `${cell.id}/roof-edge`,
			slot: 'roofEdge',
			shape: band(context, cell, house.toStorey, roofEdgeOutsetM, roofEdgeThicknessM)
		}
	];
}

function openingsOnSide(context: Context, quad: readonly Vec2[], i: number, storey: number): Box[] {
	const wall = side(quad, i);
	const count = Math.floor(wall.length / windowPitchM);
	const ground = storey === 0;
	const height = ground ? groundOpeningHeightM : windowHeightM;
	const z = level(context, storey) + (ground ? 0 : windowSillM) + height / 2;
	return Array.from({ length: count }, (_, k) => {
		const [x, y] = wall.at((k + 0.5) / count, 0);
		return {
			center: [x, y, z],
			size: [windowWidthM, openingDepthM, height],
			rotation: wall.rotation
		};
	});
}

/** All openings of a built cell on its exposed sides, as one mesh part. */
export function openings(context: Context, cell: FineCell, house: HouseCell): Part[] {
	const boxes: Box[] = [];
	for (let storey = house.fromStorey; storey < house.toStorey; storey += 1)
		cell.quad.forEach((_, i) => {
			if (exposed(context, cell, i, storey))
				boxes.push(...openingsOnSide(context, cell.quad, i, storey));
		});
	const shape = boxMesh(boxes);
	return shape ? [{ id: `${cell.id}/openings`, slot: 'opening', shape }] : [];
}
