import type { HouseSite } from './types';
import { planEnsemble } from '../house-typology';
import { required } from '../required';
import type { HouseObstacle } from './clearance';
import type { HouseUse, Stacks } from '../../data/house-body';
import type { EnsembleDistrict } from '../district-frame';
import { neighborsOf, type QuadGrid } from '../quad-grid';
import { planHouse } from './section';
import { houseLinks } from './links';
import { sectionParts } from './projection';

type Survey = {
	seedFor?: (id: string) => number | undefined;
	district?: (id: string) => EnsembleDistrict;
	joined?: (a: string, b: string) => boolean;
};
function footprints(grid: QuadGrid, stacks: Stacks, joined: Survey['joined']) {
	const pending = new Set([...stacks.keys()].filter((id) => grid.cellsById.has(id)).sort());
	const result = [];
	for (const id of pending) {
		const row = required(stacks.get(id), 'painted stack'),
			level = row.findIndex(Boolean);
		if (level < 0) continue;
		const cells = [required(grid.cellsById.get(id), 'painted cell')];
		pending.delete(id);
		for (const cell of cells)
			for (const n of neighborsOf(grid, cell)) {
				if (!pending.has(n.id) || !sameFootprint(n, cell, row, level)) continue;
				pending.delete(n.id);
				cells.push(n);
			}
		result.push(cells);
	}
	return result;

	function sameFootprint(
		neighbor: QuadGrid['cells'][number],
		cell: QuadGrid['cells'][number],
		row: readonly HouseUse[],
		level: number
	) {
		const floors = stacks.get(neighbor.id);
		if (neighbor.pad !== cell.pad || floors?.findIndex(Boolean) !== level) return false;
		return (
			floors[level] === row[level] &&
			floors.length === row.length &&
			(!joined || joined(cell.id, neighbor.id))
		);
	}
}
function connectedEnsembles(grid: QuadGrid, sites: HouseSite[]) {
	const owner = new Map(sites.flatMap((s) => s.cells.map((c) => [c.id, s] as const)));
	const pending = new Set(sites);
	const ensembles: HouseSite[][] = [];
	for (const first of pending) {
		const ensemble = [first];
		pending.delete(first);
		for (const site of ensemble)
			for (const n of site.cells.flatMap((c) => neighborsOf(grid, c))) {
				const next = owner.get(n.id);
				if (next && ensemble.length < 8 && site.cells[0].pad === n.pad && pending.delete(next))
					ensemble.push(next);
			}
		ensembles.push(ensemble);
	}
	return ensembles;
}
/** Plans connected painted footprints of equal stack height on a common bearing datum. */
export function paintedSections(grid: QuadGrid, stacks: Stacks, seed: number, survey: Survey = {}) {
	const sites = footprints(grid, stacks, survey.joined).map((cells) => ({
		cells,
		stacks,
		seed: survey.seedFor?.(cells[0].id) ?? seed,
		district: survey.district?.(cells[0].id)
	}));
	return connectedEnsembles(grid, sites).flatMap((ensemble) => {
		const context = planEnsemble(ensemble, seed);
		return ensemble.map((site) => planHouse({ ...site, context }));
	});
}
/** Assigns each house and shared span to its anchor chunk once. */
export function sectionGroups(
	grid: QuadGrid,
	houses: ReturnType<typeof paintedSections>,
	seed: number,
	stock: HouseObstacle[] = []
) {
	const byId = new Map(houses.map((h) => [h.id, h]));
	const groups = houses.map((h) => ({
		id: h.id,
		owners: [h.id],
		span: '',
		chunk: h.cells[0].chunk,
		cells: h.cells.map((c) => c.id),
		parts: () => sectionParts(h)
	}));
	for (const link of houseLinks(grid, houses, seed, stock)) {
		const a = required(byId.get(link.a), 'first bridge owner'),
			b = required(byId.get(link.b), 'second bridge owner');
		groups.push({
			id: link.id,
			owners: [a.id, b.id],
			span: JSON.stringify([link.kind, link.width, link.route]),
			chunk: a.cells[0].chunk,
			cells: [...a.cells, ...b.cells].map((c) => c.id),
			parts: () => link.parts
		});
	}
	return groups;
}

/** Builds the batch survey for a single painted stack map. */
export function composedGroups(grid: QuadGrid, stacks: Stacks, seed: number) {
	return sectionGroups(grid, paintedSections(grid, stacks, seed), seed);
}
