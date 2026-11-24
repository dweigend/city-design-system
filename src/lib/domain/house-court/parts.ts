import type { Part, Shape } from '../../core/object';
import { defaults } from '../../../config/house-court';
import type { FineCell } from '../cell-space';
import { boxMesh, faceMesh, side, type Box } from './boxes';
import { builtAt, type Context } from './context';
import type { HouseCell } from './occupancy';
import { shellFaces, shells } from './shells';
import { entranceGround } from './access';

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

/** Window openings of one wall storey as [u0, z0, u1, z1]: meters along the side from its first
 * corner and world heights. */
export function openingRects(
	context: Context,
	cell: FineCell,
	i: number,
	storey: number
): (readonly [number, number, number, number])[] {
	const scale = context.house.scale === 'large' ? largeOpeningScaleRatio : 1;
	const wall = side(cell.quad, i);
	const count = Math.floor(wall.length / (windowPitchM * scale));
	const ground = storey === 0;
	const height = (ground ? groundOpeningHeightM : windowHeightM) * scale;
	const z = level(context, storey) + (ground ? 0 : windowSillM * scale);
	const width = windowWidthM * scale;
	return Array.from({ length: count }, (_, k) => {
		const u = ((k + 0.5) / count) * wall.length;
		return [u - width / 2, z, u + width / 2, z + height] as const;
	});
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
	return openingRects(context, cell, i, storey).map(([u0, z0, u1, z1]) => {
		const [x, y] = wall.at((u0 + u1) / 2 / wall.length, 0);
		return {
			center: [x, y, (z0 + z1) / 2],
			size: [u1 - u0, openingDepthM, z1 - z0],
			rotation: wall.rotation
		};
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
