import type { Vec3 } from '../../core/geometry';
import type { Part, Shape } from '../../core/object';
import { defaults } from '../../../config/house-court';
import type { CellSpace, FineCell } from '../cell-space';
import { boxMesh, faceMesh, side, type Box } from './boxes';
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

type Visit = (cell: FineCell, house: HouseCell) => void;

function eachBuilt(context: Context, visit: Visit) {
	for (const cell of context.space.cells) {
		const house = context.occupancy.get(cell.id);
		if (house && house.toStorey > house.fromStorey) visit(cell, house);
	}
}

function part(id: string, slot: string, shape: Shape | undefined): Part[] {
	return shape ? [{ id, slot, shape }] : [];
}

/** Ground plate of every cell below the parcel ground, and the raised court plates. */
export function plates(context: Context): Part[] {
	const z = context.space.baseZ;
	return context.space.cells.map((cell) =>
		context.occupancy.get(cell.id)?.role === 'court'
			? {
					id: `${cell.id}/court`,
					slot: 'court',
					shape: { kind: 'prism', polygon: cell.quad, base: z, top: z + courtRaiseM }
				}
			: {
					id: `${cell.id}/plot`,
					slot: 'plot',
					shape: { kind: 'prism', polygon: cell.quad, base: z - plotThicknessM, top: z }
				}
	);
}

/** The closed envelope of all built cell storeys: exposed side faces per storey, the floor under
 * each built run and the roof over it, wound outward, as one mesh in the given slot. */
export function envelope(context: Context, slot: string): Part[] {
	const faces: Vec3[][] = [];
	eachBuilt(context, (cell, house) => {
		const ring = (storey: number) =>
			cell.quad.map(([x, y]): Vec3 => [x, y, level(context, storey)]);
		faces.push([...ring(house.fromStorey)].reverse(), ring(house.toStorey));
		for (let storey = house.fromStorey; storey < house.toStorey; storey += 1) {
			const [low, high] = [ring(storey), ring(storey + 1)];
			cell.quad.forEach((_, i) => {
				const j = (i + 1) % cell.quad.length;
				if (exposed(context, cell, i, storey)) faces.push([low[i], low[j], high[j], high[i]]);
			});
		}
	});
	return part(`${context.space.id}/envelope`, slot, faceMesh(faces));
}

function strip(cell: FineCell, i: number, z: number, across: number, height: number): Box {
	const wall = side(cell.quad, i);
	const [x, y] = wall.at(1 / 2, across / 2);
	return {
		center: [x, y, z],
		size: [wall.length + across, across, height],
		rotation: wall.rotation
	};
}

/** Floor-edge strips along exposed walls at inner storey lines and above a gate, and the roof
 * edge along every wall exposed at the top storey, each as one mesh. */
export function edges(context: Context): Part[] {
	const floors: Box[] = [];
	const roofs: Box[] = [];
	eachBuilt(context, (cell, house) => {
		cell.quad.forEach((_, i) => {
			for (let storey = Math.max(1, house.fromStorey); storey < house.toStorey; storey += 1)
				if (exposed(context, cell, i, storey) || exposed(context, cell, i, storey - 1))
					floors.push(
						strip(cell, i, level(context, storey), floorEdgeOutsetM, floorEdgeThicknessM)
					);
			if (exposed(context, cell, i, house.toStorey - 1))
				roofs.push(
					strip(cell, i, level(context, house.toStorey), roofEdgeOutsetM, roofEdgeThicknessM)
				);
		});
	});
	return [
		...part(`${context.space.id}/floor-edges`, 'floorEdge', boxMesh(floors)),
		...part(`${context.space.id}/roof-edges`, 'roofEdge', boxMesh(roofs))
	];
}

function openingsOnSide(context: Context, cell: FineCell, i: number, storey: number): Box[] {
	const wall = side(cell.quad, i);
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

/** Openings on every exposed wall storey of the house, as one mesh. */
export function openings(context: Context): Part[] {
	const boxes: Box[] = [];
	eachBuilt(context, (cell, house) => {
		for (let storey = house.fromStorey; storey < house.toStorey; storey += 1)
			cell.quad.forEach((_, i) => {
				if (exposed(context, cell, i, storey))
					boxes.push(...openingsOnSide(context, cell, i, storey));
			});
	});
	return part(`${context.space.id}/openings`, 'opening', boxMesh(boxes));
}
