import { hashUnit } from '../parzelle';
import { neighborsOf } from '../quad-grid';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';
import type { SandboxState, SpongeWork } from './state';
import type { World } from './world-contract';

const WORKS = ['tank', 'retention-basin', 'green-roof', 'water-square'] as const;
// Parcel distance in lattice steps. The same neighbourhood fills outward across ticks.
const CATCHMENT_RADIUS = 8;

const drySite = (cell: TerrainCell | undefined): cell is TerrainCell =>
	!!cell && cell.plantable && cell.zone !== 'water';

function catchment(grid: TerrainGrid, state: SandboxState) {
	const town = [...state.stacks.keys()].flatMap((id) => grid.cellsById.get(id) ?? []);
	const waterUses = town.filter((cell) => state.stacks.get(cell.id)?.includes('water'));
	if (waterUses.length) return waterUses;
	if (town.length) return town;
	return grid.cells.filter(
		(cell) => drySite(cell) && neighborsOf(grid, cell).some(({ zone }) => zone === 'water')
	);
}

function availableSites(world: World): TerrainCell[] {
	const { grid, seed, state } = world;
	const origins = catchment(grid, state);
	if (!origins.length) return [];
	const count = origins.length;
	const x = origins.reduce((sum, cell) => sum + cell.column, 0) / count;
	const y = origins.reduce((sum, cell) => sum + cell.row, 0) / count;
	const reserved = new Set([
		...state.stacks.keys(),
		...state.cover.keys(),
		...(state.spongeWorks ?? []).map(({ cellId }) => cellId),
		...state.lines.flatMap(({ cellIds }) => cellIds)
	]);
	for (const part of state.parts.values()) {
		reserved.add(part.anchor.cellId);
		if (part.kind === 'segment') reserved.add(part.end.cellId);
	}
	return grid.cells
		.filter(
			(cell) =>
				drySite(cell) &&
				!reserved.has(cell.id) &&
				origins.some(
					(origin) =>
						Math.abs(cell.column - origin.column) + Math.abs(cell.row - origin.row) <=
						CATCHMENT_RADIUS
				)
		)
		.map((cell) => ({
			cell,
			distance: Math.abs(cell.column - x) + Math.abs(cell.row - y),
			draw: hashUnit(seed, cell.id, 'sponge-site', state.year)
		}))
		.sort((a, b) => a.distance - b.distance || a.draw - b.draw || a.cell.index - b.cell.index)
		.slice(0, WORKS.length)
		.map(({ cell }) => cell);
}

/** Appends up to four water works at free catchment sites for this committed year. */
export function growSpongeCity(world: World): World {
	const { state } = world;
	if (state.futureTarget !== 'sponge-city') return world;
	const works = availableSites(world).map(({ id }, index): SpongeWork => ({
		kind: WORKS[index],
		cellId: id,
		built: state.year
	}));
	if (!works.length) return world;
	return { ...world, state: { ...state, spongeWorks: [...(state.spongeWorks ?? []), ...works] } };
}

/** Clears one work when the player erases its cell or paints something in its place. */
export function removeSpongeWork(state: SandboxState, id: string): SandboxState {
	if (!state.spongeWorks?.some(({ cellId }) => cellId === id)) return state;
	return { ...state, spongeWorks: state.spongeWorks.filter(({ cellId }) => cellId !== id) };
}

/** Retains works whose cells are still dry and unreserved after a terrain intervention. */
export function settleSpongeWorks(grid: TerrainGrid, state: SandboxState): SandboxState {
	if (!state.spongeWorks) return state;
	const spongeWorks = state.spongeWorks.filter(({ cellId }) => drySite(grid.cellsById.get(cellId)));
	return spongeWorks.length === state.spongeWorks.length ? state : { ...state, spongeWorks };
}
