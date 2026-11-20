import { gradeTown } from './town-grading';
import type { CityPlan } from '../city-plan';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';

const originals = new WeakMap<TerrainGrid, TerrainGrid>();
const towns = new WeakMap<TerrainGrid, WeakMap<CityPlan, TerrainGrid>>();
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
export function townGrid(grid: TerrainGrid, city: CityPlan) {
	const raw = surveyedGrid(grid),
		plans = towns.get(raw) ?? new WeakMap<CityPlan, TerrainGrid>(),
		previous = plans.get(city);
	if (previous) return previous;
	const reserved = new Set(city.walk.flat());
	const graded = gradeTown(raw, city);
	const cells = raw.cells.map((c) => {
		const cell = passage(graded.cell(c));
		return cell.buildable && reserved.has(cell.id) ? { ...cell, buildable: false } : cell;
	});
	const next = {
		...raw,
		vertices: raw.vertices.map(graded.vertex),
		cells,
		cellsById: new Map(cells.map((c) => [c.id, c])),
		chunks: new Map([...raw.chunks].map(([id, chunk]) => [id, chunk.map((c) => cells[c.index])]))
	};
	plans.set(city, next);
	towns.set(raw, plans);
	originals.set(next, raw);
	return next;
}
