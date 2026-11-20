import type { CityPlan } from '../city-plan';
import type { Ensembles, EnsembleCell } from '../house-brush';
import type { SandboxState, StoryPart } from './state';
import { required } from '../required';
import type { TerrainGrid } from '../terrain-grid';

type Court = CityPlan['centres'][number]['ensembles'][number];
type Group = {
	grid: TerrainGrid;
	stories: (readonly StoryPart[] | undefined)[];
	members: string[];
	cells: [string, EnsembleCell][];
};
const cache = new WeakMap<Court, Group>();

const plotSets = new WeakMap<CityPlan, Set<string>>();
/** Addresses owned by the saved town plan. Older snapshots retain painted layout. */
export function plannedPlots(state: SandboxState) {
	const city = state.city;
	if (!city) return new Set<string>();
	const known = plotSets.get(city);
	if (known) return known;
	const plots = new Set(city.centres.flatMap((c) => c.ensembles?.flatMap((g) => g.lots) ?? []));
	plotSets.set(city, plots);
	return plots;
}

function survey(grid: TerrainGrid, state: SandboxState, court: Court) {
	const stories = court.lots.map((id) => state.storyParts.get(id));
	const previous = cache.get(court);
	if (previous && previous.grid === grid && stories.every((row, i) => row === previous.stories[i]))
		return previous;
	const members = court.lots.filter((id) => state.stacks.has(id));
	const cells = members.map((id): [string, EnsembleCell] => {
		const plot = required(grid.cellsById.get(id), 'planned plot');
		const neighbors = members.filter((other) => plot.neighbors.includes(other));
		return [
			id,
			{
				id: court.court,
				body: id,
				role: id === court.lots[0] ? 'turm' : 'sockel',
				height: state.stacks.get(id)?.length ?? 0,
				surcharge: 0,
				neighbors,
				front: Math.max(0, plot.neighbors.indexOf(court.court)),
				setback: 0
			}
		];
	});
	const group = { grid, stories, members, cells };
	cache.set(court, group);
	return group;
}

/** Wires planned plot heights and court frontages into the same layout used
 * by the painting tools. Unedited groups retain their component records. */
export function plannedLayout(
	grid: TerrainGrid,
	state: SandboxState,
	painted: Ensembles
): Ensembles {
	const groups = state.city?.centres.flatMap((c) => c.ensembles ?? []) ?? [];
	if (!groups.length) return painted;
	const cells = new Map(painted.cells),
		members = new Map(painted.members);
	for (const court of groups) {
		const group = survey(grid, state, court);
		members.set(court.court, group.members);
		for (const [id, cell] of group.cells) cells.set(id, cell);
	}
	return { cells, members };
}
