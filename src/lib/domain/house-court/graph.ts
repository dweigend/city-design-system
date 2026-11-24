import type { Vec2 } from '../../core/geometry';
import { cellCenter, type CellSpace, type FineCell } from '../cell-space';
import { side } from './boxes';

/** Breadth-first hop counts from the seed cells across shared sides, in cell order. */
export function hops(space: CellSpace, seeds: readonly string[]): ReadonlyMap<string, number> {
	const byId = new Map(space.cells.map((cell) => [cell.id, cell]));
	const result = new Map(
		seeds.map((id) => /* Exact arithmetic: graph seeds start at zero steps. */ [id, 0])
	);
	let frontier = [...seeds];
	while (frontier.length) {
		const next: string[] = [];
		for (const id of frontier)
			for (const { neighbour } of byId.get(id)?.sides ?? [])
				if (neighbour && !result.has(neighbour)) {
					result.set(neighbour, (result.get(id) ?? 0) + 1);
					next.push(neighbour);
				}
		frontier = next;
	}
	return result;
}

const onBoundary = (cell: FineCell) => cell.sides.some(({ neighbour }) => neighbour === null);
/** Cells touching the frontage. */
export const fronting = (cell: FineCell) => cell.sides.some(({ frontage }) => frontage);

/** Hop depth of every cell from the parcel boundary; the deepest layer is the court. */
export function boundaryDepth(space: CellSpace): ReadonlyMap<string, number> {
	return hops(
		space,
		space.cells.filter(onBoundary).map(({ id }) => id)
	);
}

function segmentDistance([px, py]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): number {
	const [dx, dy] = [bx - ax, by - ay];
	const span = dx * dx + dy * dy;
	const t = span ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span)) : 0;
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Frontage sides of all cells as plan segments in meters. */
export function frontageSegments(space: CellSpace): readonly (readonly [Vec2, Vec2])[] {
	return space.cells.flatMap(({ quad, sides }) =>
		sides.flatMap(({ frontage }, i) =>
			frontage ? [[quad[i], quad[(i + 1) % quad.length]] as const] : []
		)
	);
}

/** Plan distance in meters from a cell's centre to the nearest frontage side; infinite without one. */
export function frontageDistance(cell: FineCell, segments: readonly (readonly [Vec2, Vec2])[]) {
	const centre = cellCenter(cell);
	return Math.min(Infinity, ...segments.map(([a, b]) => segmentDistance(centre, a, b)));
}

/** Average of the frontage side midpoints, the point the entrance seeks. */
export function frontageCentre(segments: readonly (readonly [Vec2, Vec2])[]): Vec2 {
	const [x, y] = segments.reduce(
		([sx, sy], [[ax, ay], [bx, by]]) => [sx + (ax + bx) / 2, sy + (ay + by) / 2],
		/* Exact arithmetic: initial sum of XY coordinates. */ [0, 0]
	);
	return [x / segments.length, y / segments.length];
}

/** The first entrance path's cell, frontage and wall in space meters. */
export function entranceSide(space: CellSpace, entrances: readonly (readonly string[])[]) {
	const id = entrances[0]?.[0];
	const cell = space.cells.find((candidate) => candidate.id === id);
	const index = cell?.sides.findIndex(({ frontage }) => frontage) ?? -1;
	if (!cell || index < 0) return undefined;
	return { cell, index, wall: side(cell.quad, index) };
}
