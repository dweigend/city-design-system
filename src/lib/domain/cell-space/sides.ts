import type { Vec2 } from '../../core/geometry';
import { defaults } from '../../../config/cell-space';
import type { KeyedRing } from './split';

const { matchToleranceM } = defaults;

/** What lies across one side of a fine cell: another cell, or the parcel edge with its index. */
export type CellSide = Readonly<{
	neighbour: string | null;
	edge: number | null;
	frontage: boolean;
}>;

const key = ([x, y]: Vec2) =>
	`${Math.round(x / matchToleranceM)},${Math.round(y / matchToleranceM)}`;

function segmentDistance([px, py]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): number {
	const [dx, dy] = [bx - ax, by - ay];
	const span = dx * dx + dy * dy;
	const t = span ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span)) : 0;
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function parcelEdge(a: Vec2, b: Vec2, outline: readonly Vec2[]): number | null {
	const n = outline.length;
	for (let edge = 0; edge < n; edge += 1) {
		const [from, to] = [outline[edge], outline[(edge + 1) % n]];
		if (
			segmentDistance(a, from, to) <= matchToleranceM &&
			segmentDistance(b, from, to) <= matchToleranceM
		)
			return edge;
	}
	return null;
}

/** Resolves every side of every cell to the neighbour sharing it or the parcel edge it lies on.
 * A side matching neither throws: the split never leaves a hanging corner. */
export function resolveSides(
	cells: readonly KeyedRing[],
	outline: readonly Vec2[],
	frontage: ReadonlySet<number>
): readonly (readonly CellSide[])[] {
	const owners = new Map<string, string>();
	const sideKey = (cell: KeyedRing, i: number, reverse: boolean) => {
		const [a, b] = [cell.points[i], cell.points[(i + 1) % cell.points.length]];
		return reverse ? `${key(b)}>${key(a)}` : `${key(a)}>${key(b)}`;
	};
	for (const cell of cells)
		cell.points.forEach((_, i) => owners.set(sideKey(cell, i, false), cell.id));
	return cells.map((cell) =>
		cell.points.map((a, i): CellSide => {
			const neighbour = owners.get(sideKey(cell, i, true)) ?? null;
			if (neighbour) return { neighbour, edge: null, frontage: false };
			const edge = parcelEdge(a, cell.points[(i + 1) % cell.points.length], outline);
			if (edge === null) throw new RangeError(`Cell side ${cell.id}#${i} has no partner`);
			return { neighbour: null, edge, frontage: frontage.has(edge) };
		})
	);
}
