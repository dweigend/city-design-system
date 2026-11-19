import { planEnsembles, type Ensembles, type HouseUse, type Stacks } from '../house-brush';
import { neighborsOf, type QuadGrid } from '../quad-grid';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';
import type { SandboxState } from './state';

function pathOn(side: TerrainCell | undefined) {
	return side && (side.plan.kind || side.zone === 'water');
}

function frontage(grid: TerrainGrid, cell: TerrainCell) {
	if (cell.alleyEdges) return [0, 1, 2, 3].find((side) => cell.alleyEdges & (1 << side)) ?? 0;
	const paths = cell.neighbors.map((id) => id && grid.cellsById.get(id));
	const near = paths.findIndex((side) => side && pathOn(side));
	if (near >= 0) return near;
	const next = paths.findIndex((side) => side && neighborsOf(grid, side).some(pathOn));
	if (next >= 0) return next;
	// Use the lowest edge if the parcel has no surveyed approach within a cell.
	return cell.corners.reduce(
		(low, a, i, corners) =>
			a[2] + corners[(i + 1) % 4][2] < corners[low][2] + corners[(low + 1) % 4][2] ? i : low,
		0
	);
}

/** Maps the surveyed terrain zone to its house composition policy. */
export function houseDistrict(cell: TerrainCell) {
	return cell.zone === 'floodplain' ? 'bank' : cell.zone === 'lower-terrace' ? 'infill' : 'slope';
}

function placements(grid: TerrainGrid, state: SandboxState) {
	return new Map(
		[...state.storyParts].flatMap(([id, stories]) => {
			const placed = stories
				.map((story) => Number(story.id.split('/')[1]))
				.find((action) => action > 0);
			const cell = grid.cellsById.get(id);
			if (placed === undefined || !cell) return [];
			const district = houseDistrict(cell);
			const top = stories.at(-1);
			return [
				[
					id,
					{ placed, front: frontage(grid, cell), district, layer: `${top?.built}/${top?.style}` }
				]
			] as const;
		})
	);
}

const layouts = new WeakMap<TerrainGrid, WeakMap<SandboxState, Map<number, Ensembles>>>();
const latest = new WeakMap<TerrainGrid, Ensembles>();

/** Caches the derived ensemble layout for immutable terrain, paint state and seed. */
export function houseEnsembles(
	grid: TerrainGrid,
	plots: QuadGrid,
	state: SandboxState,
	seed: number
): Ensembles {
	const states = layouts.get(grid) ?? new WeakMap<SandboxState, Map<number, Ensembles>>();
	layouts.set(grid, states);
	const seeds = states.get(state) ?? new Map<number, Ensembles>();
	states.set(state, seeds);
	const existing = seeds.get(seed);
	if (existing) return existing;
	const layout = planEnsembles(
		grid,
		plots,
		state.stacks,
		placements(grid, state),
		seed,
		latest.get(grid)
	);
	seeds.set(seed, layout);
	latest.set(grid, layout);
	return layout;
}

/** Adds derived top storeys only to the phase owning the painted top. Saved stacks stay intact. */
export function ensembleFloors(stacks: Stacks, occupied: Stacks, layout: Ensembles): Stacks {
	const extended = new Map(stacks);
	for (const [id, floors] of stacks) {
		const surcharge = layout.cells.get(id)?.surcharge ?? 0;
		const top = floors.at(-1);
		if (surcharge && top && floors.length === occupied.get(id)?.length) {
			const next = floors.slice();
			next.push(...Array<HouseUse>(surcharge).fill(top));
			extended.set(id, next);
		}
	}
	return extended;
}

/** Includes components incident to edited parcels in this snapshot. */
export function ensembleEditCells(grid: TerrainGrid, layout: Ensembles, edits: Iterable<string>) {
	const cells = new Set<string>();
	const groups = new Set<string>();
	const visit = (id: string) => {
		const group = layout.cells.get(id)?.id;
		if (group) groups.add(group);
	};
	for (const id of edits) {
		const cell = grid.cellsById.get(id);
		if (!cell) continue;
		cells.add(id);
		visit(id);
		visitNeighbors(cell);
	}
	for (const group of groups) for (const id of layout.members.get(group) ?? []) cells.add(id);
	return cells;

	function visitNeighbors(cell: TerrainGrid['cells'][number]) {
		const id = cell.id;
		for (const next of neighborsOf(grid, cell)) {
			visit(next.id);
			if (!layout.cells.has(id)) for (const far of neighborsOf(grid, next)) visit(far.id);
		}
	}
}
