import type { Vec2, Vec3 } from '../../core/geometry';
import { PlaceableObject, type Anchor } from '../../core/object';
import { cellAreaM2, cellCenter, type CellSpace } from '../cell-space';
import { createWorldReference } from '../../core/ref';
import { Random } from '../../core/random';
import { courtSides, entranceStepCell, entranceSteps, galleries, stair, stairSide } from './access';
import { entranceSide } from './graph';
import type { Context } from './context';
import { caps, figureOpenings, trees } from './dress';
import { cellSolids, type CellSolid } from './fills';
import { additionFrames, structure } from './structure';
import { envelopeFaces, solidFaces, type HouseFace } from './faces';
import { houseStyleFor } from './scale';
import { houseStyles, type HouseStyle } from './styles';
import { side } from './boxes';
import {
	createHouseOccupancy,
	type HouseInputs,
	type HouseOccupancy,
	type HouseSite
} from './occupancy';
import {
	partAddresses,
	lazyFaceParts,
	slicePartId,
	type HousePart,
	type HousePartAddress,
	type HousePartRef
} from './part-refs';
import { canopy, envelope, envelopeRims, openings, plates, solidRims } from './parts';
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
	entranceSteps = false,
	additions = false
): readonly string[] {
	if (detail === 'block') return unique(['plot', 'court', 'mass', additions && 'frame']);
	const { fill, opening, parts, slots } = style;
	const envelopeFill = fill.kinds.includes('envelope');
	return unique([
		'plot',
		'court',
		envelopeFill && 'wall',
		envelopeFill && parts.rims && 'rim',
		...slots.body,
		...slots.roof,
		...slots.capsule,
		opening.collar && 'collar',
		'opening',
		parts.accent && 'accent',
		(parts.frame || additions) && 'frame',
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
	house: HouseOccupancy,
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
	return /* Exact arithmetic: door normal is horizontal. */ {
		name: 'court',
		position: [x, y, ctx.space.baseZ],
		normal: [...door.normal, 0]
	};
}

function courtEntry(ctx: Context, house: HouseOccupancy): Vec2 | undefined {
	const last = ctx.space.cells.find(({ id }) => id === house.entrances[0]?.at(-1));
	const index =
		last?.sides.findIndex(
			({ neighbour }) => neighbour !== null && ctx.occupancy.get(neighbour)?.role === 'court'
		) ?? -1;
	return last && index >= 0 ? side(last.quad, index).at(1 / 2, 0) : undefined;
}

function anchors(ctx: Context, house: HouseOccupancy): Anchor[] {
	const entry = entranceSide(ctx.space, house.entrances);
	const courtCells = ctx.space.cells.filter(({ id }) => ctx.occupancy.get(id)?.role === 'court');
	const result: Anchor[] = [];
	if (entry) {
		const [x, y] = entry.wall.at(1 / 2, 0);
		result.push(
			/* Exact arithmetic: entrance normal is horizontal. */ {
				name: 'entrance',
				position: [x, y, ctx.space.baseZ - (entranceStepCell(ctx) ? house.site.entranceRiseM : 0)],
				normal: [...entry.wall.normal, 0]
			}
		);
	}
	const door = courtDoor(ctx);
	if (door) result.push(door);
	if (courtCells.length) {
		const [x, y] = courtCells
			.map(cellCenter)
			.reduce(
				([sx, sy], [px, py]) => [sx + px / courtCells.length, sy + py / courtCells.length],
				/* Exact arithmetic: initial sum of XY coordinates. */ [0, 0]
			);
		result.push(
			/* Exact arithmetic: court anchor faces up. */ {
				name: 'court',
				position: [x, y, ctx.space.baseZ],
				normal: [0, 0, 1] satisfies Vec3
			}
		);
	}
	return result;
}

function footprint(space: CellSpace) {
	const points = space.cells.flatMap(({ quad }) => quad);
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}

function solidParts(
	ctx: Context,
	solids: readonly CellSolid[],
	block: boolean,
	references: boolean
): HousePart[] {
	return solids.flatMap((solid) => {
		const { key, slot, cell, fromStorey, toStorey, roofKind } = solid;
		const role = block ? 'mass' : slot;
		if (references && !roofKind && !key.includes('/capsule/'))
			return Array.from({ length: toStorey - fromStorey }, (_, offset) => {
				const from = fromStorey + offset;
				return lazyFaceParts(
					slicePartId(cell.id, 'body', ctx.space.datumIndex + from),
					role,
					[[cell.id, from, from + 1]],
					() => solid.faces,
					{ body: true }
				);
			}).flat();
		return lazyFaceParts(key, role, [[cell.id, fromStorey, toStorey]], () => solid.faces, {
			body: true,
			...(roofKind ? { programRun: [cell.id, fromStorey - 1, fromStorey] as const } : {})
		});
	});
}

function envelopeParts(ctx: Context, detail: HouseDetail, references: boolean): HousePart[] {
	if (!ctx.style.fill.kinds.includes('envelope')) return [];
	if (detail === 'block') return envelope(ctx, 'mass');
	return [
		...envelope(ctx, 'wall', references),
		...(ctx.style.parts.rims ? envelopeRims(ctx, 'rim') : []),
		...openings(ctx)
	];
}

function accessParts(ctx: Context, house: HouseOccupancy): HousePart[] {
	const steps = ctx.style.parts.stair ? entranceSteps(ctx, 'stair') : [];
	if (!ctx.style.parts.galleries) return steps;
	const sides = courtSides(ctx, house.inputs.complexity);
	const landing = ctx.style.parts.stair ? stairSide(ctx, sides, courtEntry(ctx, house)) : undefined;
	return [...galleries(ctx, sides, landing), ...stair(ctx, landing), ...steps];
}

function allParts(
	ctx: Context,
	house: HouseOccupancy,
	detail: HouseDetail,
	references = false
): HousePart[] {
	const solids = cellSolids(ctx);
	const appliedFrame = ctx.style.parts.frame && detail === 'full' ? [] : additionFrames(ctx);
	if (detail === 'block')
		return [
			...plates(ctx),
			...entranceSteps(ctx, 'plot'),
			...envelopeParts(ctx, detail, references),
			...solidParts(ctx, solids, true, references),
			...appliedFrame
		];
	return [
		...plates(ctx),
		...envelopeParts(ctx, detail, references),
		...solidParts(ctx, solids, false, references),
		...(ctx.style.parts.rims ? solidRims(ctx, solids) : []),
		...figureOpenings(ctx, solids),
		...(ctx.style.parts.accent ? canopy(ctx) : []),
		...caps(ctx, solids),
		...structure(ctx),
		...appliedFrame,
		...trees(ctx),
		...accessParts(ctx, house)
	];
}

const assemblyInputs = Symbol('house assembly inputs');

/** Immutable occupancy with an ID and the local part addresses of its full-detail object. */
export type HouseCourt = HouseOccupancy &
	Readonly<{
		id: string;
		partAddresses: readonly HousePartAddress[];
		[assemblyInputs]: Readonly<{ space: CellSpace; style: HouseStyle }>;
	}>;

/** Plans a house around a court. Local part addresses are derived on first read. */
export function createHouseCourt(
	space: CellSpace,
	inputs: HouseInputs,
	style: HouseStyle = houseStyles.neutral,
	site: HouseSite = {}
): HouseCourt {
	const house = createHouseOccupancy(space, inputs, style, site);
	const id = houseId(space);
	let addresses: readonly HousePartAddress[] | undefined;
	const ctx = () =>
		context(space, house, houseStyleFor(space, style, house.inputs.seed, house.scale), []);
	return Object.freeze({
		...house,
		id,
		[assemblyInputs]: Object.freeze({ space, style }),
		get partAddresses() {
			return (addresses ??= partAddresses(id, space, house, allParts(ctx(), house, 'full', true)));
		}
	});
}

/** Mints world-scoped refs for full-detail parts, with one stable body address per occupied slice. */
export function readHousePartRefs(
	house: HouseCourt,
	world: string,
	adjoiningWalls: readonly AdjoiningWall[] = []
): readonly HousePartRef[] {
	const { space, style } = house[assemblyInputs];
	const addresses = adjoiningWalls.length
		? partAddresses(
				house.id,
				space,
				house,
				allParts(
					context(
						space,
						house,
						houseStyleFor(space, style, house.inputs.seed, house.scale),
						adjoiningWalls
					),
					house,
					'full',
					true
				)
			)
		: house.partAddresses;
	return Object.freeze(
		addresses.map(({ key, storeyKeys, ...part }) =>
			Object.freeze({
				...part,
				ref: createWorldReference(world, 'house-part', key),
				storeyRefs: Object.freeze(
					storeyKeys.map((key) => createWorldReference(world, 'storey', key))
				)
			})
		)
	);
}

const houseId = (space: CellSpace) => `house/${space.id}`;

/** Builds the house as one placeable object in the space's meters from its style row: cell
 * plates; for an `envelope` fill the merged envelope shells with a parapet rim and plain openings;
 * otherwise one closed solid per cell body, capsule or roof inside its own cell, flat tops with a
 * parapet rim; then figure openings, the entrance canopy accent, planted caps, frame and services,
 * court trees, galleries, the court stair and the entrance steps. The row is applied at the house's scale (`houseStyleFor`): a calm
 * house draws few kinds and colours, a large one its row's large tendency. Galleries also run
 * along parcel edges onto a shared court. `block` keeps plates, solids and steps, as slots `mass`
 * and `plot`. No colours; slots name roles (MAT-1). Anchors: `entrance` on the frontage at lane
 * level, `court` at the own court's centre or at the middle of the longest built side onto a
 * shared court. Occupancy of another space (by cell identities) or another style throws
 * RangeError. Adjoining walls suppress openings on the covered portion of a party wall. */
export function createHouseObject(
	space: CellSpace,
	house: HouseOccupancy,
	detail: HouseDetail,
	style: HouseStyle = houseStyles.neutral,
	adjoiningWalls: readonly AdjoiningWall[] = []
): PlaceableObject {
	const used = houseStyleFor(space, style, house.inputs.seed, house.scale);
	const ctx = context(space, house, used, adjoiningWalls);
	return createObject(ctx, detail, allParts(ctx, house, detail));
}

/** Assembles geometry and matching addresses in one pass for a storey-aware projection. */
export function createHouseAssembly(
	space: CellSpace,
	house: HouseCourt,
	detail: HouseDetail,
	style: HouseStyle,
	adjoiningWalls: readonly AdjoiningWall[] = []
) {
	const ctx = context(
		space,
		house,
		houseStyleFor(space, style, house.inputs.seed, house.scale),
		adjoiningWalls
	);
	const parts = allParts(ctx, house, detail);
	return {
		object: createObject(ctx, detail, parts),
		addresses: partAddresses(house.id, space, house, parts)
	};
}

function createObject(ctx: Context, detail: HouseDetail, parts: readonly HousePart[]) {
	const { space, style, house } = ctx;
	return PlaceableObject.create({
		id: houseId(space),
		slots: houseSlots(
			style,
			detail,
			entranceStepCell(ctx) !== undefined,
			house.cells.some(({ program }) => program?.some(({ phase }) => phase === 'addition'))
		),
		parts,
		footprint: footprint(space),
		anchors: anchors(ctx, house)
	});
}

/** The cell whose ground the entrance steps take, when the site's entrance rise needs steps. */
export function entranceStepCellId(space: CellSpace, house: HouseOccupancy): string | undefined {
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
	house: HouseOccupancy,
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
export function houseFigures(space: CellSpace, house: HouseOccupancy) {
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
