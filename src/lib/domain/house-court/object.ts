import type { Vec2, Vec3 } from '../../core/geometry';
import { PlaceableObject, type Anchor, type Part } from '../../core/object';
import { cellAreaM2, cellCentre, type CellSpace } from '../cell-space';
import { courtSides, galleries, stair } from './access';
import { side } from './boxes';
import type { HouseCourt } from './occupancy';
import { edges, envelope, openings, plates, type Context } from './parts';

/** Slots per drawing detail. `full` carries the skin parts, `block` one closed mass per built cell. */
export const houseDetails = Object.freeze({
	full: Object.freeze([
		'plot',
		'court',
		'wall',
		'floorEdge',
		'roofEdge',
		'opening',
		'gallery',
		'stair'
	]),
	block: Object.freeze(['plot', 'court', 'mass'])
});

/** A drawing detail of the house object. */
export type HouseDetail = keyof typeof houseDetails;

function context(space: CellSpace, house: HouseCourt): Context {
	if (space.id !== house.spaceId || space.cells.length !== house.cells.length)
		throw new RangeError('House occupancy belongs to another cell space');
	return { space, occupancy: new Map(house.cells.map((cell) => [cell.id, cell])) };
}

function entrancePoint(ctx: Context, house: HouseCourt): { point: Vec2; normal: Vec2 } | undefined {
	const [first] = house.entrances[0] ?? [];
	const cell = ctx.space.cells.find(({ id }) => id === first);
	const index = cell?.sides.findIndex(({ frontage }) => frontage) ?? -1;
	if (!cell || index < 0) return undefined;
	const wall = side(cell.quad, index);
	return { point: wall.at(1 / 2, 0), normal: wall.normal };
}

function courtEntry(ctx: Context, house: HouseCourt): Vec2 | undefined {
	const last = ctx.space.cells.find(({ id }) => id === house.entrances[0]?.at(-1));
	const index =
		last?.sides.findIndex(
			({ neighbour }) => neighbour !== null && ctx.occupancy.get(neighbour)?.role === 'court'
		) ?? -1;
	return last && index >= 0 ? side(last.quad, index).at(1 / 2, 0) : undefined;
}

function anchors(ctx: Context, house: HouseCourt): Anchor[] {
	const entry = entrancePoint(ctx, house);
	const courtCells = ctx.space.cells.filter(({ id }) => ctx.occupancy.get(id)?.role === 'court');
	const result: Anchor[] = [];
	if (entry) {
		const [x, y] = entry.point;
		result.push({
			name: 'entrance',
			position: [x, y, ctx.space.baseZ],
			normal: [...entry.normal, 0]
		});
	}
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

function bodyParts(ctx: Context, detail: HouseDetail): Part[] {
	if (detail === 'block') return [...plates(ctx), ...envelope(ctx, 'mass')];
	return [...plates(ctx), ...envelope(ctx, 'wall'), ...edges(ctx), ...openings(ctx)];
}

/** Builds the house as one placeable object in the space's meters: cell plates, then the closed
 * envelope of all built cell storeys (slot `mass` for `block`; `wall` plus floor-edge strips, roof
 * edge and openings for `full`), then court galleries and the stair. No colours; slots name roles (MAT-1).
 * Anchors: `entrance` on the frontage, `court` at the court's centre. A house of another space throws. */
export function createHouseObject(
	space: CellSpace,
	house: HouseCourt,
	detail: HouseDetail
): PlaceableObject {
	const ctx = context(space, house);
	const access = detail === 'full' ? courtSides(ctx, house.inputs.complexity) : [];
	return PlaceableObject.create({
		id: `house/${space.id}`,
		slots: houseDetails[detail],
		parts: [
			...bodyParts(ctx, detail),
			...galleries(ctx, access),
			...stair(ctx, access, courtEntry(ctx, house))
		],
		footprint: footprint(space),
		anchors: anchors(ctx, house)
	});
}

/** Built and void cell counts, gross floor area and court area in m², and the tallest storey count. */
export function houseFigures(space: CellSpace, house: HouseCourt) {
	const ctx = context(space, house);
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
		cells: ctx.space.cells.length
	});
}
