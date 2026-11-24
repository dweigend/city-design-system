import type { Part, Shape } from '../../core/object';
import { defaults } from '../../../config/house-court';
import type { FineCell } from '../cell-space';
import { boxMesh, faceMesh, side, type Box } from './boxes';
import { builtAt, type Context } from './context';
import type { HouseCell } from './occupancy';
import { shellFaces, shells } from './shells';

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

/** Ground plate of every cell below the parcel ground, and the raised court plates. A cell whose
 * ground the entrance steps take (`skip`) has no plate. */
export function plates(context: Context, skip: ReadonlySet<string> = new Set()): Part[] {
	const z = context.space.baseZ;
	return context.space.cells.filter(({ id }) => !skip.has(id)).map((cell) =>
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

function openingsOnSide(
	context: Context,
	cell: FineCell,
	i: number,
	storey: number,
	scale: number
): Box[] {
	const wall = side(cell.quad, i);
	const count = Math.floor(wall.length / (windowPitchM * scale));
	const ground = storey === 0;
	const height = (ground ? groundOpeningHeightM : windowHeightM) * scale;
	const z = level(context, storey) + (ground ? 0 : windowSillM * scale) + height / 2;
	return Array.from({ length: count }, (_, k) => {
		const [x, y] = wall.at((k + 0.5) / count, 0);
		return {
			center: [x, y, z],
			size: [windowWidthM * scale, openingDepthM, height],
			rotation: wall.rotation
		};
	});
}

/** Openings on every exposed wall storey of the house, as one mesh. A large house takes a few big
 * openings instead: the ground storey only, pitch and size scaled by the large opening ratio. */
// Exact arithmetic: a regular house keeps the unit scale.
export function openings(context: Context): Part[] {
	const large = context.house.scale === 'large';
	const scale = large ? largeOpeningScaleRatio : 1;
	const boxes: Box[] = [];
	eachBuilt(context, (cell, house) => {
		const last = large ? Math.min(house.toStorey, house.fromStorey + 1) : house.toStorey;
		for (let storey = house.fromStorey; storey < last; storey += 1)
			cell.quad.forEach((_, i) => {
				if (exposed(context, cell, i, storey))
					boxes.push(...openingsOnSide(context, cell, i, storey, scale));
			});
	});
	return part(`${context.space.id}/openings`, 'opening', boxMesh(boxes));
}
