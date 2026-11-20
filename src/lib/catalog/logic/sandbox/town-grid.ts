import type { TerrainCell, TerrainGrid } from '../terrain-grid';

const originals = new WeakMap<TerrainGrid, TerrainGrid>();
const towns = new WeakMap<TerrainGrid, TerrainGrid>();
const passages = new WeakMap<TerrainCell, TerrainCell>();

function passage(cell: TerrainCell): TerrainCell {
	if (!cell.plan.stairAlley) return cell;
	const previous = passages.get(cell);
	if (previous) return previous;
	const next = { ...cell, plan: { ...cell.plan, kind: 'alley' as const, stairAlley: false } };
	passages.set(cell, next);
	return next;
}

/** Recovers the underlying terrain survey for regridding or restoring a world without a town. */
export function surveyedGrid(grid: TerrainGrid) {
	return originals.get(grid) ?? grid;
}

/** Towns supply physical stair flights. Keep the alley reservations as ordinary passages. */
export function townGrid(grid: TerrainGrid) {
	const raw = surveyedGrid(grid),
		previous = towns.get(raw);
	if (previous) return previous;
	const cells = raw.cells.map(passage);
	const next = {
		...raw,
		cells,
		cellsById: new Map(cells.map((c) => [c.id, c])),
		chunks: new Map([...raw.chunks].map(([id, chunk]) => [id, chunk.map(passage)]))
	};
	towns.set(raw, next);
	originals.set(next, raw);
	return next;
}
