import { surveyPlaza } from './plaza';
import { area } from '../ansicht/geometrie';
import { required } from '../required';
import { hashUnit } from '../../core/random';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';
type Survey = { grid: TerrainGrid; free: Set<string>; open: Set<string>; gates: Set<string> };
function cornerLots(court: TerrainCell, wings: TerrainCell[], free: Set<string>) {
	return wings.flatMap((side, i) =>
		wings
			.slice(i + 1)
			.flatMap((next) =>
				side.neighbors.filter(
					(id): id is string =>
						!!id && id !== court.id && free.has(id) && next.neighbors.includes(id)
				)
			)
	);
}
function wingLots(s: Survey, court: TerrainCell, mouth: TerrainCell, wings: TerrainCell[]) {
	const corners = cornerLots(court, wings, s.free);
	if (corners.length !== wings.length - 1) return;
	const size = (id: string) =>
		area(required(s.grid.cellsById.get(id), 'court plot').corners.map(([x, y]) => [x, y]));
	corners.sort((a, b) => size(b) - size(a));
	const peak = size(corners[0]);
	if (wings.some((w) => size(w.id) > peak)) return;
	const lots = [corners[0], ...wings.map((w) => w.id), ...corners.slice(1)];
	const forbidden = new Set([...lots, court.id, mouth.id]);
	const extension = wings
		.flatMap((w) => w.neighbors)
		.find((id) => id && s.free.has(id) && !forbidden.has(id) && size(id) <= peak);
	const openingPlots = lots.length;
	if (extension) lots.push(extension);
	const plaza = surveyPlaza(s.grid, court, mouth, lots, s.open, s.gates, wings);
	if (!plaza) return;
	const low = 2 + Math.floor(hashUnit(s.grid.terrain.seed, court.id, 'base') * 2);
	return {
		court: court.id,
		mouth: plaza.mouth,
		plaza,
		lots,
		heights: lots.map((_, i) => low + Number(i === 0) * 2),
		openingPlots
	};
}
/** Surveys three-sided wings, or adjoining corner wings where intact stock narrows the court. */
export function* courtGroup(s: Survey, court: TerrainCell, compact: boolean) {
	const sides = court.neighbors.flatMap((id) => (id ? (s.grid.cellsById.get(id) ?? []) : []));
	for (const mouth of sides.filter((c) => s.open.has(c.id))) {
		const wings = sides.filter((c) => c !== mouth && s.free.has(c.id));
		const sets = compact ? wings.flatMap((a, i) => wings.slice(i + 1).map((b) => [a, b])) : [wings];
		for (const set of sets.filter((set) => set.length === (compact ? 2 : 3))) {
			const plot = wingLots(s, court, mouth, set);
			if (plot) yield plot;
		}
	}
}
