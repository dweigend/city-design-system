import { buildingPlots } from './building-plots';
import { sandboxEpochs } from '../../data/sandbox';
import { houseChunk, type HouseUse, type Stacks } from '../house-brush';
import { present, type Focus } from '../presentation';
import type { SandboxState } from './state';
import type { World } from './world';

const phasesByState = new WeakMap<SandboxState, ReadonlyMap<number, Stacks>>();
const empty: Stacks = new Map();

/** Groups the immutable construction record by year, retaining original floor indices. */
export function constructionPhases(state: SandboxState): ReadonlyMap<number, Stacks> {
	const cached = phasesByState.get(state);
	if (cached) return cached;
	const phases = new Map<number, Map<string, HouseUse[]>>();
	for (const [id, uses] of state.stacks) {
		state.storyParts.get(id)?.forEach(({ built }, level) => {
			const phase = phases.get(built) ?? new Map<string, HouseUse[]>();
			const floors = phase.get(id) ?? [];
			floors[level] = uses[level];
			phase.set(id, floors);
			phases.set(built, phase);
		});
	}
	phasesByState.set(state, phases);
	return phases;
}

/** Current stories retain their original floor indices for the house massing grammar. */
export const currentStacks = (state: SandboxState): Stacks =>
	constructionPhases(state).get(state.year) ?? empty;

/** Seeded stock uses pencil terraces. Later additions keep their built form as they age to pencil. */
export function houseView(
	world: World,
	stacks: Stacks,
	chunk: string,
	focus: Focus,
	earliestFullYear = world.state.year
) {
	const { grid, state, seed } = world;
	const project = (floors: Stacks, built: number) =>
		houseChunk(buildingPlots(grid), floors, chunk, seed, styleForYear(built), {
			occupied: state.stacks,
			// Plots already exclude passages; roof runs stay within the original lattice block.
			blockOf: (id) => grid.cellsById.get(id)?.block.split('/')[0],
			olderRoof: (id) => (state.storyParts.get(id)?.at(-1)?.built ?? Infinity) < built
		});
	const stock = [...constructionPhases(state)].flatMap(([built, floors]) =>
		built < earliestFullYear ? project(floors, built) : []
	);
	const earlierAdditions = [...constructionPhases(state)].flatMap(([built, floors]) =>
		built >= earliestFullYear && built < state.year ? project(floors, built) : []
	);
	return [
		...present(stock, focus.stock),
		...present([...earlierAdditions, ...project(stacks, state.year)], focus.houses)
	];
}

/** Selects the newest epoch starting by the build year; earlier stock uses the oldest style. */
export function styleForYear(built: number) {
	return sandboxEpochs.findLast((epoch) => epoch.from <= built)?.style ?? sandboxEpochs[0].style;
}
