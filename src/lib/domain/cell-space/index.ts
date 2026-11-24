import type { Vec2 } from '../../core/geometry';
import { defaults } from '../../../config/cell-space';
import { resolveSides } from './sides';
import { convexParts, cornerQuads, doubleArea, mergedParts, type KeyedRing } from './split';
import { cellWidth, stripRings } from './strips';
import type { CellSpace, FineCell, Parcel } from './types';
import { validate } from './validate';

/** What lies across one side of a fine cell. */
export type { CellSide } from './sides';
/** Strip counts of a parcel and the width measure of a cell's sliver check. */
export { cellWidth, stripCounts, type StripCounts } from './strips';
/** Smallest accepted strip cell width in meters. */
export const minimumStripWidthM = defaults.stripMinimumWidthM;
/** Thrown for a parcel with a vanishing edge or area. */
export { DegenerateParcelError } from './validate';

/** Default storey height in meters, two per 7 m coarse level (CITY-12). */
export const defaultStoreyHeightM = defaults.storeyHeightM;

/** Smallest supported separation of consecutive parcel corners in plan meters. */
export const minimumParcelEdgeM = defaults.minimumEdgeM;

/** Identity of the parcel edge from one corner key to the next. */
export function parcelEdgeId(from: string, to: string): string {
	return JSON.stringify([from, to]);
}

/** Parcel, fine cell and cell space shapes. */
export type { CellSpace, FineCell, Parcel, ParcelCorner } from './types';

/** Address of one storey of a fine cell: `<cell id>/storey/<integer from 0>`. */
export function storeyAddress(cellId: string, storey: number): string {
	if (!Number.isInteger(storey) || storey < 0) throw new RangeError('Expected a storey index');
	return `${cellId}/storey/${storey}`;
}

function refine(quad: KeyedRing, rounds: number): readonly KeyedRing[] {
	let cells: readonly KeyedRing[] = [quad];
	for (let round = 0; round < rounds; round += 1)
		cells = cells.flatMap((cell) => cornerQuads(cell, false));
	return cells;
}

function canonicalRing(parcel: Parcel): KeyedRing {
	const n = parcel.corners.length;
	const ids = parcel.corners.map(({ id }) => id);
	const start = ids.indexOf([...ids].sort()[0]);
	const corners = ids.map((_, i) => parcel.corners[(start + i) % n]);
	return {
		id: encodeURIComponent(parcel.id),
		corner: '',
		ear: null,
		keys: corners.map(({ id }) => id),
		points: corners.map(({ position }) => position),
		edges: corners.map(({ id }, i) => parcelEdgeId(id, corners[(i + 1) % n].id))
	};
}

/** Splits a parcel into fine cells by the GRID-1 rule. The ring starts at its smallest corner key;
 * a re-entrant parcel is ear-clipped into triangles (lowest ear first, no corner on a diagonal),
 * every convex part becomes one quad per corner through its vertex average and edge midpoints, and
 * each quad is refined the same way `rounds` times (an integer from 0 to 3). IDs:
 * `<escaped parcel id>[/ear/<JSON corner keys>]/child/<JSON [corner key]>`, refined cells append
 * `/child/<JSON [corner|next|centre|previous]>`. Invalid parcels throw RangeError, degenerate ones
 * DegenerateParcelError. */
export function createCellSpace(
	parcel: Parcel,
	rounds: number = defaults.refinementRounds
): CellSpace {
	validate(parcel, rounds);
	const parents = convexParts(canonicalRing(parcel)).flatMap((part) => cornerQuads(part, true));
	const cells = parents.flatMap((quad) =>
		refine(quad, rounds).map((cell) => ({ cell, parent: quad.id }))
	);
	return freeze(
		parcel,
		cells.map(({ cell }) => cell),
		cells.map(({ parent }) => parent),
		cells.map(({ cell }) => cell.corner)
	);
}

function freeze(
	parcel: Parcel,
	rings: readonly KeyedRing[],
	parents: readonly string[],
	corners: readonly string[]
): CellSpace {
	const sides = resolveSides(rings, new Set(parcel.frontage), new Set(parcel.courtEdges ?? []));
	return Object.freeze({
		id: parcel.id,
		baseZ: parcel.baseZ,
		storeyHeightM: parcel.storeyHeightM ?? defaults.storeyHeightM,
		storeyCount: parcel.storeyCount,
		cells: Object.freeze(
			rings.map((cell, i) =>
				Object.freeze({
					id: cell.id,
					parent: parents[i],
					corner: corners[i],
					ear: cell.ear,
					quad: Object.freeze(cell.points.map(([x, y]) => Object.freeze<Vec2>([x, y]))),
					sides: Object.freeze(sides[i].map((side) => Object.freeze({ ...side })))
				})
			)
		)
	});
}

/** Splits a parcel into strip cells that follow its frontage (GRID-1 for town parcels): columns
 * across the first frontage edge and depth rows parallel to it, laid as a Coons patch over the
 * four parcel sides (front, the edge after it, the rear chain, the edge before it). Counts come
 * from the frontage length and mean side depth over the target cell edge, between the minimum and
 * maximum cell count; columns break at rear corners so rear sides follow the parcel. A count that
 * leaves a cell non-convex or narrower than the minimum width steps down, columns first; a parcel
 * no count fits (a re-entrant notch the depth rows would cross) is cut into convex parts (the ear
 * triangles merged while convex), each strip-split from its side on the frontage or its longest
 * outer side, with IDs under `<escaped parcel id>/part/<index>`; the sides between parts carry
 * `seamEdgeId` identities instead of a neighbour. Strip IDs:
 * `<escaped parcel id>/strip/<JSON [column, row]>`, row 0 on the frontage; `parent` is the
 * column `<escaped parcel id>/strip/<JSON [column]>` and `corner` is empty. Throws like
 * `createCellSpace`. */
// Exact arithmetic: no refinement rounds.
export function createStripSpace(parcel: Parcel): CellSpace {
	validate(parcel, 0);
	const ring = canonicalRing(parcel);
	const edgeAt = (i: number) =>
		parcelEdgeId(parcel.corners[i].id, parcel.corners[(i + 1) % parcel.corners.length].id);
	const rings = stripRings(parcel, ring.id, edgeAt) ?? partStrips(parcel, ring);
	return freeze(
		parcel,
		rings,
		rings.map(({ corner }) => corner),
		rings.map(() => '')
	);
}

/** Identity of an inner seam between two convex parts of a parcel, from one corner key to the next. */
export function seamEdgeId(from: string, to: string): string {
	return JSON.stringify(['seam', from, to]);
}

/** The side of a convex part a strip split fronts: the part's side on the parcel frontage, else its
 * longest side on the parcel boundary, else its longest side. */
// Exact arithmetic: side indices.
function partFront(part: KeyedRing, frontage: ReadonlySet<string>): number {
	const length = (i: number) => {
		const [a, b] = [part.points[i], part.points[(i + 1) % part.points.length]];
		return Math.hypot(b[0] - a[0], b[1] - a[1]);
	};
	const sides = part.keys.map((_, i) => i);
	const longest = (list: number[]) => list.sort((a, b) => length(b) - length(a))[0];
	const fronting = sides.filter((i) => frontage.has(part.edges[i] ?? ''));
	const outer = sides.filter((i) => part.edges[i] !== null);
	return longest(fronting.length ? fronting : outer.length ? outer : sides);
}

/** Strip cells of each convex part of a parcel the strip split cannot take whole. Seams between
 * parts carry `seamEdgeId` identities; a part no strip count fits stays one cell. */
function partStrips(parcel: Parcel, ring: KeyedRing): readonly KeyedRing[] {
	const frontage = new Set(parcel.frontage);
	return mergedParts(ring).flatMap((part, k) => {
		const edges = part.edges.map(
			(edge, i) => edge ?? seamEdgeId(part.keys[i], part.keys[(i + 1) % part.keys.length])
		);
		const front = partFront(part, frontage);
		const corners = part.keys.map((id, i) => ({ id, position: part.points[i] }));
		const id = `${ring.id}/part/${k}`;
		const strips = stripRings(
			{ ...parcel, corners, frontage: [edges[front]] },
			id,
			(i) => edges[i]
		);
		return strips ?? [{ ...part, id, corner: id, edges }];
	});
}

/** Width of a fine cell in meters: twice its area over its perimeter. */
export function fineCellWidth(cell: FineCell): number {
	return cellWidth(cell.quad);
}

/** Plan area of a fine cell in square meters. */
export function cellAreaM2(cell: FineCell): number {
	return doubleArea(cell.quad) / 2;
}

// Exact arithmetic: vertex average of a quad.
/** Vertex average of a fine cell in plan meters. */
export function cellCentre({ quad }: FineCell): Vec2 {
	const [x, y] = quad.reduce(([sx, sy], [px, py]) => [sx + px, sy + py], [0, 0]);
	return [x / quad.length, y / quad.length];
}
