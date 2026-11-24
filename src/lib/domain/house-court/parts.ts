import type { Part, Shape } from '../../core/object';
import { defaults } from '../../../config/house-court';
import type { FineCell } from '../cell-space';
import { boxMesh, faceMesh, side, type Box } from './boxes';
import { builtAt, type Context } from './context';
import type { HouseCell } from './occupancy';
import { shellFaces, shells } from './shells';
import { entranceGround } from './access';
import { exposedWall, fitsOpening, type WallRect } from './wall-contact';

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
	courtRaiseM,
	largeOpeningScaleRatio
} = defaults;

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

/** Ground plate of every cell below the parcel ground, and the raised court plates, reaching down
 * to the site's lowest ground as a plinth when the site gives one. The entrance cell with steps
 * keeps plates only on the ground the steps leave free. */
export function plates(context: Context): Part[] {
	const z = context.space.baseZ;
	const low = context.house.site.groundZ;
	const base = low === null ? z - plotThicknessM : Math.min(low, z - plotThicknessM);
	const ground = entranceGround(context);
	return context.space.cells.flatMap((cell): Part[] => {
		if (cell.id === ground?.cell.id)
			return ground.rest.map((polygon, k) => ({
				id: `${cell.id}/plot/${k}`,
				slot: 'plot',
				shape: { kind: 'prism', polygon, base, top: z }
			}));
		return [
			context.occupancy.get(cell.id)?.role === 'court'
				? {
						id: `${cell.id}/court`,
						slot: 'court',
						shape: {
							kind: 'prism',
							polygon: cell.quad,
							base: low === null ? z : base,
							top: z + courtRaiseM
						}
					}
				: {
						id: `${cell.id}/plot`,
						slot: 'plot',
						shape: { kind: 'prism', polygon: cell.quad, base, top: z }
					}
		];
	});
}

/** The closed envelope of all built cell storeys in the given slot, one mesh per shell: storeys
 * that touch only along an edge go to separate shells, so every shell is two-manifold. The first
 * shell keeps the ID `<space>/envelope`, later ones append `/<index>`. */
export function envelope(context: Context, slot: string): Part[] {
	return shells(context).flatMap((members, k) => {
		const faces = shellFaces(context, members).map(({ points }) => points);
		const id = k ? `${context.space.id}/envelope/${k}` : `${context.space.id}/envelope`;
		return part(id, slot, faceMesh(faces));
	});
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

function openingRun(context: Context, length: number, storey: number) {
	const scale = context.house.scale === 'large' ? largeOpeningScaleRatio : 1;
	const count = Math.floor(length / (windowPitchM * scale));
	const ground = storey === 0;
	const sill = ground ? 0 : windowSillM * scale;
	const nominalHeight = (ground ? groundOpeningHeightM : windowHeightM) * scale;
	const nominalWidth = windowWidthM * scale;
	const height = Math.min(nominalHeight, context.space.storeyHeightM - sill);
	const width = count === 0 ? nominalWidth : Math.min(nominalWidth, length / count);
	return { count: height > 0 ? count : 0, width, height, z: level(context, storey) + sill };
}

function openingRect(u: number, { width, height, z }: ReturnType<typeof openingRun>): WallRect {
	return [u - width / 2, z, u + width / 2, z + height];
}

/** Window openings of one wall storey in side meters and world heights. */
export function openingRects(
	context: Context,
	cell: FineCell,
	i: number,
	storey: number
): WallRect[] {
	const wall = side(cell.quad, i);
	const run = openingRun(context, wall.length, storey);
	return Array.from({ length: run.count }, (_, k) =>
		openingRect(((k + 0.5) / run.count) * wall.length, run)
	);
}

/** The storeys of a built run that carry window openings: all, or the ground storey of a large
 * house. */
// Exact arithmetic: one storey.
export function openingStoreys(context: Context, house: HouseCell): number {
	return context.house.scale === 'large'
		? Math.min(house.toStorey, house.fromStorey + 1)
		: house.toStorey;
}

function openingsOnSide(context: Context, cell: FineCell, i: number, storey: number): Box[] {
	const wall = side(cell.quad, i);
	const run = openingRun(context, wall.length, storey);
	const base = level(context, storey);
	const visible = exposedWall(
		context.adjoiningWalls,
		wall,
		base,
		base + context.space.storeyHeightM
	);
	return Array.from({ length: run.count }, (_, k) => (k + 0.5) / run.count).flatMap((t) => {
		if (context.adjoiningWalls.length && !fitsOpening(visible, openingRect(t * wall.length, run)))
			return [];
		const [x, y] = wall.at(t, 0);
		return [
			{
				center: [x, y, run.z + run.height / 2],
				size: [run.width, openingDepthM, run.height],
				rotation: wall.rotation
			}
		];
	});
}

/** Openings on every exposed wall storey of the house, as one mesh. A large house takes a few big
 * openings instead: the ground storey only, pitch and size scaled by the large opening ratio. */
export function openings(context: Context): Part[] {
	const boxes: Box[] = [];
	eachBuilt(context, (cell, house) => {
		for (let storey = house.fromStorey; storey < openingStoreys(context, house); storey += 1)
			cell.quad.forEach((_, i) => {
				if (exposed(context, cell, i, storey))
					boxes.push(...openingsOnSide(context, cell, i, storey));
			});
	});
	return part(`${context.space.id}/openings`, 'opening', boxMesh(boxes));
}
