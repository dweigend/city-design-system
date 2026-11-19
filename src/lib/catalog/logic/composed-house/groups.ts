import { required } from '../required';
import type { HouseObstacle } from './clearance';
import type { Stacks } from '../../data/house-body';
import type { EnsembleDistrict } from '../district-frame';
import { neighborsOf, type QuadGrid } from '../quad-grid';
import { planHouse } from './section';
import { houseLinks } from './links';
import { sectionParts } from './projection';

type Survey = {
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
				const floors = stacks.get(n.id);
				if (
					!pending.has(n.id) ||
					n.pad !== cell.pad ||
					floors?.findIndex(Boolean) !== level ||
					floors[level] !== row[level] ||
					floors.length !== row.length ||
					(joined && !joined(cell.id, n.id))
				)
					continue;
				pending.delete(n.id);
				cells.push(n);
			}
		result.push(cells);
	}
	return result;
}
/** Plans connected painted footprints of equal stack height on a common bearing datum. */
export function paintedSections(grid: QuadGrid, stacks: Stacks, seed: number, survey: Survey = {}) {
	return footprints(grid, stacks, survey.joined).map((cells) =>
		planHouse({ cells, stacks, seed, district: survey.district?.(cells[0].id) })
	);
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
