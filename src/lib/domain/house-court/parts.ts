import type { Vec2 } from '../../core/geometry';
import type { Part, Shape } from '../../core/object';
import { defaults } from '../../../config/house-court';
import type { FineCell } from '../cell-space';
import { boxMesh, faceMesh, side, type Box } from './boxes';
import { extrusion, type Faces } from './solids';
import { builtAt, type Context } from './context';
import type { HouseCell } from './occupancy';
import { shellFaces, shells } from './shells';
import { entranceGround } from './access';
import { cellSolids, type CellSolid } from './fills';
import { entranceSide } from './graph';
import { exposedWall, fitsOpening, type WallRect } from './wall-contact';

const {
	parapetHeightM,
	rimWidthM,
	entranceCanopySizeM,
	entranceCanopyHeightM,
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

/** The inner corner k of a rim of `rimWidthM` along a counter-clockwise outline: the corner moved
 * inward along the bisector, so neighbouring rim sides meet in a mitre inside the outline. */
// Exact arithmetic: unit outward normals of the two sides meeting at the corner.
function mitre(outline: readonly Vec2[], k: number): Vec2 {
	const n = outline.length;
	const [a, b] = [side(outline, (k + n - 1) % n).normal, side(outline, k).normal];
	const scale = rimWidthM / Math.max(1 + a[0] * b[0] + a[1] * b[1], 1 / 2);
	return [outline[k][0] - (a[0] + b[0]) * scale, outline[k][1] - (a[1] + b[1]) * scale];
}

/** A parapet rim along side i of a flat roof outline: the band between the side and its mitred
 * inner line, standing on the roof at height z. */
// Exact arithmetic: index arithmetic of a reversed ring.
function rim(outline: readonly Vec2[], i: number, z: number): Faces {
	const ring = signedArea(outline) < 0 ? [...outline].reverse() : outline;
	const n = outline.length;
	const k = signedArea(outline) < 0 ? (2 * n - 2 - i) % n : i;
	const j = (k + 1) % ring.length;
	return extrusion([ring[k], ring[j], mitre(ring, j), mitre(ring, k)], z, z + parapetHeightM);
}

// Exact arithmetic: the shoelace sum; positive for a counter-clockwise outline.
function signedArea(outline: readonly Vec2[]) {
	return outline.reduce((sum, [x0, y0], i) => {
		const [x1, y1] = outline[(i + 1) % outline.length];
		return sum + x0 * y1 - x1 * y0;
	}, 0);
}

/** The parapet rim of the merged envelope (MAT-13): along every wall exposed at the top storey,
 * in the given slot, as one mesh. */
export function envelopeRims(context: Context, slot: string): Part[] {
	const rims: Faces = [];
	eachBuilt(context, (cell, house) => {
		cell.quad.forEach((_, i) => {
			if (exposed(context, cell, i, house.toStorey - 1))
				rims.push(...rim(cell.quad, i, level(context, house.toStorey)));
		});
	});
	return part(`${context.space.id}/rims`, slot, faceMesh(rims));
}

/** The parapet rim of every flat-topped body without a roof solid, in the body's slot. */
export function solidRims(context: Context, solids: readonly CellSolid[]): Part[] {
	const roofed = new Set(
		solids.filter(({ key }) => key.endsWith('/roof')).map(({ cell }) => cell.id)
	);
	const tops = new Map<string, CellSolid>();
	for (const s of solids) if (!s.key.endsWith('/roof')) tops.set(s.cell.id, s);
	return [...tops.values()].flatMap((s) => {
		if (!s.flat || roofed.has(s.cell.id)) return [];
		const z = level(context, s.toStorey);
		return part(
			`${s.key}/rims`,
			s.slot,
			faceMesh(s.outline.flatMap((_, i) => rim(s.outline, i, z)))
		);
	});
}

/** The accent of the house (MAT-10): a canopy slab over the entrance, against the body that
 * stands in the entrance cell, in the `accent` slot. */
// Exact arithmetic: the middle of the frontage side.
export function canopy(context: Context): Part[] {
	const entry = entranceSide(context.space, context.house.entrances);
	const house = entry && context.occupancy.get(entry.cell.id);
	if (!entry || !house || house.fromStorey > 0 || house.toStorey <= 0) return [];
	const [width, projection, thickness] = entranceCanopySizeM;
	const solids = cellSolids(context).filter(
		({ cell, fromStorey, key }) =>
			cell.id === entry.cell.id && fromStorey === 0 && !key.endsWith('/roof')
	);
	const gap = solids.length ? Math.min(...solids.map(({ gapM }) => gapM)) : 0;
	const [x, y] = entry.wall.at(1 / 2, projection / 2 - gap);
	const z = context.space.baseZ + entranceCanopyHeightM + thickness / 2;
	return part(
		`${context.space.id}/canopy`,
		'accent',
		boxMesh([
			{
				center: [x, y, z],
				size: [Math.min(width, entry.wall.length), projection, thickness],
				rotation: entry.wall.rotation
			}
		])
	);
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
