import { deckCorners } from '../walkway';
import { intersect } from '../parametrik/raster/geometry';
import { area, type Point2 } from '../ansicht/geometrie';
import type { Vec3 } from '../parametrik/types';
import { townSections } from './composed-projection';
import { buildingPlots } from './building-plots';
import { overlaps, planBounds } from './network-site';
import type { World } from './world-contract';
import type { TownPassage } from '../walkway-network';

type Section = ReturnType<typeof townSections>['sections'][number];
type Survey = (section: Section) => readonly TownPassage[];
function occupied(world: World) {
	const plots = buildingPlots(world.grid);
	const reserved = new Set([
		...world.state.stacks.keys(),
		...(world.state.city?.centres.flatMap((c) => c.ensembles?.flatMap((e) => e.lots) ?? []) ?? [])
	]);
	return [...reserved].flatMap((id) => {
		const cell = plots.cellsById.get(id);
		if (!cell) return [];
		const polygon = cell.corners.map(([x, y]): Point2 => [x, y]);
		return [{ id, polygon, bounds: planBounds(polygon) }];
	});
}
function clearApproach(lots: ReturnType<typeof occupied>, a: Vec3, b: Vec3, width: number) {
	const deck = deckCorners(a, b, width).map(([x, y]): Point2 => [x, y]),
		bounds = planBounds(deck);
	return lots.every(
		(lot) => !overlaps(lot.bounds, bounds) || area(intersect(deck, lot.polygon)) <= 1e-7
	);
}
/** Tests the complete walking width of a candidate contour approach against occupied plots. */
export function cityRibbonClearance(world: World) {
	const lots = occupied(world);
	return (a: Vec3, b: Vec3) => clearApproach(lots, a, b, 2.5);
}
/** Associates each measured through-opening with its served ensemble. External approaches
 * must clear every other built or reserved plot at the full walking width. */
export function cityPassages(world: World, survey: Survey) {
	const lots = occupied(world);
	const byCell = new Map(
		world.state.city?.centres.flatMap(
			(c) => c.ensembles?.flatMap((e) => e.lots.map((lot) => [lot, e.court] as const)) ?? []
		) ?? []
	);
	const byCourt = new Map<string, TownPassage[]>();
	for (const section of townSections(world).sections) {
		const court = byCell.get(section.cells[0].id);
		if (!court) continue;
		const host = new Set(section.cells.map((c) => c.id)),
			neighbours = lots.filter((l) => !host.has(l.id));
		const openings = survey(section).map((p) => ({
			...p,
			clearApproach: (a: Vec3, b: Vec3, width: number) => clearApproach(neighbours, a, b, width)
		}));
		byCourt.set(court, [...(byCourt.get(court) ?? []), ...openings]);
	}
	return byCourt;
}
