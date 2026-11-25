import { measurePointSegmentDistance, readVertexMean, type Vec2 } from '../../core/geometry';
import { cellCenter, type CellSpace, type FineCell } from '../cell-space';

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
	return Math.min(Infinity, ...segments.map(([a, b]) => measurePointSegmentDistance(centre, a, b)));
}

/** Average of the frontage side midpoints, the point the entrance seeks. */
export function frontageCentre(segments: readonly (readonly [Vec2, Vec2])[]): Vec2 {
	return readVertexMean(segments.map(([[ax, ay], [bx, by]]) => [(ax + bx) / 2, (ay + by) / 2]));
}

/** The first entrance path’s cell and the index of its frontage side, if present. */
export function readEntranceSide(space: CellSpace, entrances: readonly (readonly string[])[]) {
	const id = entrances[0]?.[0];
	const cell = space.cells.find((candidate) => candidate.id === id);
	const index = cell?.sides.findIndex(({ frontage }) => frontage) ?? -1;
	if (!cell || index < 0) return undefined;
	return { cell, index };
}

/** The selected frontage midpoint in meters, evaluated at zero wall offset. */
export function readEntranceMidpoint({ quad }: FineCell, index: number): Vec2 {
	const [a, b] = [quad[index], quad[(index + 1) % quad.length]];
	const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
	const length = Math.hypot(dx, dy);
	// Keep the wall sampler's arithmetic, including signed zero.
	return [a[0] + dx * (1 / 2) + (dy / length) * 0, a[1] + dy * (1 / 2) - (dx / length) * 0];
}

function neighboursIn(space: Map<string, FineCell>, id: string, court: ReadonlySet<string>) {
	return (space.get(id)?.sides ?? []).flatMap(({ neighbour }) =>
		neighbour && court.has(neighbour) ? [neighbour] : []
	);
}

/** Connected components of the selected cells, in cell and traversal order. */
export function components(space: CellSpace, court: ReadonlySet<string>): string[][] {
	const byId = new Map(space.cells.map((cell) => [cell.id, cell]));
	const seen = new Set<string>();
	const groups: string[][] = [];
	for (const { id } of space.cells) {
		if (!court.has(id) || seen.has(id)) continue;
		const group = [id];
		seen.add(id);
		for (let k = 0; k < group.length; k += 1)
			for (const neighbour of neighboursIn(byId, group[k], court))
				if (!seen.has(neighbour)) {
					seen.add(neighbour);
					group.push(neighbour);
				}
		groups.push(group);
	}
	return groups;
}
