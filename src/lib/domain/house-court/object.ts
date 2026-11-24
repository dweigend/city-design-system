import type { Vec2, Vec3 } from '../../core/geometry';
import { PlaceableObject, type Anchor, type Part } from '../../core/object';
import { cellAreaM2, cellCentre, type CellSpace } from '../cell-space';
import { Random } from '../../core/random';
import { courtSides, entranceStepCell, entranceSteps, galleries, stair, stairSide } from './access';
import { faceMesh } from './boxes';
import { entranceSide } from './graph';
import type { Context } from './context';
import { caps, figureOpenings, patterns, trees } from './dress';
import { cellSolids, type CellSolid } from './fills';
import { structure } from './structure';
import { envelopeFaces, solidFaces, type HouseFace } from './faces';
import { houseStyleFor } from './scale';
import { houseStyles, type HouseStyle } from './styles';
import { side } from './boxes';
import type { HouseCourt } from './occupancy';
import { edges, envelope, openings, plates } from './parts';
import type { AdjoiningWall } from './wall-contact';

/** A drawing detail of the house object: `full` carries every part of the style, `block` only the
 * closed solids as one `mass` slot. */
export type HouseDetail = 'full' | 'block';

const unique = (slots: readonly (string | false)[]) => [
	...new Set(slots.filter((slot): slot is string => !!slot))
];

/** The ordered role slots a style declares at a detail. Set `entranceSteps` to include the
 * stair slot for a stepped entrance on a style that supports stairs without galleries. */
export function houseSlots(
	style: HouseStyle,
	detail: HouseDetail,
	entranceSteps = false
): readonly string[] {
	if (detail === 'block') return ['plot', 'court', 'mass'];
	const { fill, opening, parts, slots } = style;
	const envelopeFill = fill.kinds.includes('envelope');
	return unique([
		'plot',
		'court',
		envelopeFill && 'wall',
		parts.edges && 'floorEdge',
		parts.edges && 'roofEdge',
		...slots.body,
		...slots.roof,
		...slots.capsule,
		parts.patternShareRatio > 0 && 'pattern',
		opening.collar && 'collar',
		'opening',
		parts.frame && 'frame',
		parts.frame && 'deck',
		parts.frame && 'tube',
		parts.frame && 'mast',
		parts.planters && 'planter',
		parts.treeShareRatio > 0 && 'trunk',
		parts.treeShareRatio > 0 && 'foliage',
		parts.galleries && 'gallery',
		parts.stair && (parts.galleries || entranceSteps) && 'stair'
	]);
}

function context(
	space: CellSpace,
	house: HouseCourt,
	style: HouseStyle,
	adjoiningWalls: readonly AdjoiningWall[]
): Context {
	const ids = space.cells.map(({ id }) => id);
	if (
		space.id !== house.spaceId ||
		ids.length !== house.cellIds.length ||
		ids.some((id, i) => id !== house.cellIds[i])
	)
		throw new RangeError('House occupancy belongs to another cell space');
	if (style.id !== house.styleId)
		throw new RangeError('House occupancy was made with another style');
	if (style.fill.kinds.includes('envelope') && style.fill.kinds.length > 1)
		throw new RangeError('An envelope fill must be the only fill kind of a style');
	return {
		space,
		occupancy: new Map(house.cells.map((cell) => [cell.id, cell])),
		style,
		random: Random.create({ seed: house.inputs.seed }).derive('skin'),
		complexity: house.inputs.complexity,
		house,
		adjoiningWalls
	};
}

// Exact arithmetic: the middle of the side, horizontal normal.
function courtDoor(ctx: Context): Anchor | undefined {
	const doors = ctx.space.cells.flatMap((cell) =>
		cell.sides.flatMap((s, i) =>
			s.court && (ctx.occupancy.get(cell.id)?.toStorey ?? 0) > 0 ? [side(cell.quad, i)] : []
		)
	);
	const door = doors.sort((a, b) => b.length - a.length)[0];
	if (!door) return undefined;
	const [x, y] = door.at(1 / 2, 0);
	return { name: 'court', position: [x, y, ctx.space.baseZ], normal: [...door.normal, 0] };
}

function courtEntry(ctx: Context, house: HouseCourt): Vec2 | undefined {
	const last = ctx.space.cells.find(({ id }) => id === house.entrances[0]?.at(-1));
	const index =
		last?.sides.findIndex(
			({ neighbour }) => neighbour !== null && ctx.occupancy.get(neighbour)?.role === 'court'
		) ?? -1;
	return last && index >= 0 ? side(last.quad, index).at(1 / 2, 0) : undefined;
}

// Exact arithmetic: structural counts, origins and unit axes, not tunables.
function anchors(ctx: Context, house: HouseCourt): Anchor[] {
	const entry = entranceSide(ctx.space, house.entrances);
	const courtCells = ctx.space.cells.filter(({ id }) => ctx.occupancy.get(id)?.role === 'court');
	const result: Anchor[] = [];
	if (entry) {
		const [x, y] = entry.wall.at(1 / 2, 0);
		result.push({
			name: 'entrance',
			position: [x, y, ctx.space.baseZ - (entranceStepCell(ctx) ? house.site.entranceRiseM : 0)],
			normal: [...entry.wall.normal, 0]
		});
	}
	const door = courtDoor(ctx);
	if (door) result.push(door);
	if (courtCells.length) {
		const [x, y] = courtCells
			.map(cellCentre)
			.reduce(
				([sx, sy], [px, py]) => [sx + px / courtCells.length, sy + py / courtCells.length],
				[0, 0]
			);
		result.push({
			name: 'court',
			position: [x, y, ctx.space.baseZ],
			normal: [0, 0, 1] satisfies Vec3
		});
	}
	return result;
}

function footprint(space: CellSpace) {
	const points = space.cells.flatMap(({ quad }) => quad);
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}

function solidParts(solids: readonly CellSolid[], block: boolean): Part[] {
	return solids.flatMap(({ key, slot, faces }) => {
		const shape = faceMesh(faces);
		return shape ? [{ id: key, slot: block ? 'mass' : slot, shape }] : [];
	});
}

function envelopeParts(ctx: Context, detail: HouseDetail): Part[] {
	if (!ctx.style.fill.kinds.includes('envelope')) return [];
	if (detail === 'block') return envelope(ctx, 'mass');
	return [...envelope(ctx, 'wall'), ...(ctx.style.parts.edges ? edges(ctx) : []), ...openings(ctx)];
}

function accessParts(ctx: Context, house: HouseCourt): Part[] {
	const steps = ctx.style.parts.stair ? entranceSteps(ctx, 'stair') : [];
	if (!ctx.style.parts.galleries) return steps;
	const sides = courtSides(ctx, house.inputs.complexity);
	const landing = ctx.style.parts.stair ? stairSide(ctx, sides, courtEntry(ctx, house)) : undefined;
	return [...galleries(ctx, sides, landing), ...stair(ctx, landing), ...steps];
}

function allParts(ctx: Context, house: HouseCourt, detail: HouseDetail): Part[] {
	const solids = cellSolids(ctx);
	if (detail === 'block')
		return [
			...plates(ctx),
			...entranceSteps(ctx, 'plot'),
			...envelopeParts(ctx, detail),
			...solidParts(solids, true)
		];
	return [
		...plates(ctx),
		...envelopeParts(ctx, detail),
		...solidParts(solids, false),
		...patterns(ctx, solids),
		...figureOpenings(ctx, solids),
		...caps(ctx, solids),
		...structure(ctx),
		...trees(ctx),
		...accessParts(ctx, house)
	];
}

/** Builds the house as one placeable object in the space's meters from its style row: cell
 * plates; for an `envelope` fill the merged envelope shells with floor edges, roof edges and window
 * rows; otherwise one closed solid per cell body, capsule or roof inside its own cell; then
 * stripes, figure openings, planted caps, frame and services, court trees, galleries, the court
 * stair and the entrance steps. The row is applied at the house's scale (`houseStyleFor`): a calm
 * house draws few kinds and colours, a large one its row's large tendency. Galleries also run
 * along parcel edges onto a shared court. `block` keeps plates, solids and steps, as slots `mass`
 * and `plot`. No colours; slots name roles (MAT-1). Anchors: `entrance` on the frontage at lane
 * level, `court` at the own court's centre or at the middle of the longest built side onto a
 * shared court. Occupancy of another space (by cell identities) or another style throws
 * RangeError. Adjoining walls suppress openings on the covered portion of a party wall. */
export function createHouseObject(
	space: CellSpace,
	house: HouseCourt,
	detail: HouseDetail,
	style: HouseStyle = houseStyles.neutral,
	adjoiningWalls: readonly AdjoiningWall[] = []
): PlaceableObject {
	const used = houseStyleFor(space, style, house.inputs.seed, house.scale);
	const ctx = context(space, house, used, adjoiningWalls);
	return PlaceableObject.create({
		id: `house/${space.id}`,
		slots: houseSlots(used, detail, entranceStepCell(ctx) !== undefined),
		parts: allParts(ctx, house, detail),
		footprint: footprint(space),
		anchors: anchors(ctx, house)
	});
}

/** The cell whose ground the entrance steps take, when the site's entrance rise needs steps. */
export function entranceStepCellId(space: CellSpace, house: HouseCourt): string | undefined {
	const occupancy = new Map(house.cells.map((cell) => [cell.id, cell]));
	return entranceStepCell({ space, occupancy, house })?.cell.id;
}

/** The planar faces of a house that surface families can clad, in the space's meters: the merged
 * envelope's walls with their window openings and flat tops, the walls of flat-sided cell bodies
 * (blocks, chamfers) without the sides another body hides, their flat tops, and wedge roof planes.
 * Curved fills, domes, cones and capsules have no planar faces and stay unclad. Faces carry the
 * role slot of their part at the full detail; at the block detail every face is `mass`. Applies
 * the style row at the house's scale like `createHouseObject`. Adjoining walls remove only
 * their occupied spans from otherwise exposed faces. */
export function houseFaces(
	space: CellSpace,
	house: HouseCourt,
	detail: HouseDetail,
	style: HouseStyle = houseStyles.neutral,
	adjoiningWalls: readonly AdjoiningWall[] = []
): readonly HouseFace[] {
	const used = houseStyleFor(space, style, house.inputs.seed, house.scale);
	const ctx = context(space, house, used, adjoiningWalls);
	const solids = cellSolids(ctx);
	const faces = [
		...(used.fill.kinds.includes('envelope') ? envelopeFaces(ctx, 'wall', solids) : []),
		...solidFaces(ctx, solids)
	];
	return detail === 'block' ? faces.map((face) => ({ ...face, slot: 'mass' })) : faces;
}

/** Built and void cell counts, gross floor area and court area in m², and the tallest storey count. */
export function houseFigures(space: CellSpace, house: HouseCourt) {
	const ids = space.cells.map(({ id }) => id);
	if (ids.length !== house.cellIds.length || ids.some((id, i) => id !== house.cellIds[i]))
		throw new RangeError('House occupancy belongs to another cell space');
	const area = new Map(space.cells.map((cell) => [cell.id, cellAreaM2(cell)]));
	const built = house.cells.filter(({ toStorey, fromStorey }) => toStorey > fromStorey);
	return Object.freeze({
		builtCells: built.length,
		voidCells: house.cells.length - built.length,
		floorAreaM2: built.reduce(
			(sum, { id, toStorey, fromStorey }) => sum + (area.get(id) ?? 0) * (toStorey - fromStorey),
			0
		),
		courtAreaM2: house.cells
			.filter(({ role }) => role === 'court')
			.reduce((sum, { id }) => sum + (area.get(id) ?? 0), 0),
		storeys: Math.max(0, ...built.map(({ toStorey }) => toStorey)),
		cells: space.cells.length
	});
}
