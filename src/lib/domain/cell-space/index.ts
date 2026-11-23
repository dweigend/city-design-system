import type { Vec2 } from '../../core/geometry';
import { defaults } from '../../../config/cell-space';
import { levelHeight, storeysPerLevel } from '../city-volume';
import { resolveSides, type CellSide } from './sides';
import { convexParts, cornerQuads, doubleArea, type KeyedRing } from './split';

/** What lies across one side of a fine cell. */
export type { CellSide } from './sides';

/** Height of one storey in meters, two per coarse 7 m level (CITY-12). */
export const storeyHeightM = levelHeight / storeysPerLevel;

/** One corner of a parcel outline: a stable key and its plan position in meters. */
export type ParcelCorner = Readonly<{ id: string; position: Vec2 }>;

/** A plan polygon of three or more corners, counterclockwise, convex or with re-entrant corners.
 * `frontage` lists the edge indices (edge i runs from corner i to corner i + 1) that face the
 * street. `baseZ` is the ground elevation and `storeyCount` the vertical extent of the space. */
export type Parcel = Readonly<{
	id: string;
	corners: readonly ParcelCorner[];
	frontage: readonly number[];
	baseZ: number;
	storeyCount: number;
}>;

/** One fine plan cell: a counterclockwise quad in meters and, per side i (corner i to i + 1),
 * the neighbour or parcel edge across it. `parent` is the corner quad it was refined from. */
export type FineCell = Readonly<{
	id: string;
	parent: string;
	quad: readonly Vec2[];
	sides: readonly CellSide[];
}>;

/** The space a building rule fills: fine plan cells stacked in storeys from `baseZ`. Any source
 * that delivers this shape (a free parcel, a city bay, a later parcel package) can feed a rule. */
export type CellSpace = Readonly<{
	id: string;
	baseZ: number;
	storeyHeightM: number;
	storeyCount: number;
	cells: readonly FineCell[];
}>;

/** Address of one storey of a fine cell: `<cell id>/storey/<integer from 0>`. */
export function storeyAddress(cellId: string, storey: number): string {
	if (!Number.isInteger(storey) || storey < 0) throw new RangeError('Expected a storey index');
	return `${cellId}/storey/${storey}`;
}

function refine(quads: readonly KeyedRing[], rounds: number): readonly KeyedRing[] {
	let cells = quads;
	for (let round = 0; round < rounds; round += 1) cells = cells.flatMap(cornerQuads);
	return cells;
}

function validate({ corners, frontage, storeyCount }: Parcel) {
	if (corners.length < 3) throw new RangeError('A parcel needs at least three corners');
	if (new Set(corners.map(({ id }) => id)).size !== corners.length)
		throw new RangeError('Parcel corner keys must be unique');
	if (doubleArea(corners.map(({ position }) => position)) <= 0)
		throw new RangeError('Parcel corners must run counterclockwise');
	if (!frontage.every((edge) => Number.isInteger(edge) && edge >= 0 && edge < corners.length))
		throw new RangeError('Frontage edges must index the parcel edges');
	if (!Number.isInteger(storeyCount) || storeyCount < 1)
		throw new RangeError('A cell space needs at least one storey');
}

/** Splits a parcel into fine cells by the GRID-1 rule: a re-entrant parcel is first ear-clipped
 * into triangles (lowest ear index first), every convex part becomes one quad per corner through
 * its vertex average and edge midpoints, and each quad is refined the same way
 * `refinementRounds` times. Corner-quad IDs are `<parcel id>/child/<JSON [corner key]>` (ears add
 * `/ear/<index>` before `/child`), refined cells append `/child/["corner"|"next"|"centre"|"previous"]`.
 * Invalid parcels throw RangeError. */
export function createCellSpace(
	parcel: Parcel,
	rounds: number = defaults.refinementRounds
): CellSpace {
	validate(parcel);
	const outline = parcel.corners.map(({ position }) => position);
	const ring = { id: parcel.id, keys: parcel.corners.map(({ id }) => id), points: outline };
	const parents = convexParts(ring).flatMap(cornerQuads);
	const cells = parents.flatMap((quad) =>
		refine([quad], rounds).map((cell) => ({ cell, parent: quad.id }))
	);
	const sides = resolveSides(
		cells.map(({ cell }) => cell),
		outline,
		new Set(parcel.frontage)
	);
	return Object.freeze({
		id: parcel.id,
		baseZ: parcel.baseZ,
		storeyHeightM,
		storeyCount: parcel.storeyCount,
		cells: Object.freeze(
			cells.map(({ cell, parent }, i) =>
				Object.freeze({
					id: cell.id,
					parent,
					quad: Object.freeze(cell.points.map((point) => Object.freeze([...point]) as Vec2)),
					sides: Object.freeze(sides[i].map((side) => Object.freeze({ ...side })))
				})
			)
		)
	});
}

/** Plan area of a fine cell in square meters. */
export function cellAreaM2(cell: FineCell): number {
	return doubleArea(cell.quad) / 2;
}

/** Vertex average of a fine cell in plan meters. */
export function cellCentre({ quad }: FineCell): Vec2 {
	const [x, y] = quad.reduce(([sx, sy], [px, py]) => [sx + px, sy + py], [0, 0]);
	return [x / quad.length, y / quad.length];
}
