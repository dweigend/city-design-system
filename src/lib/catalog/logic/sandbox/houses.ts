import type { BuildingMethod } from '../../data/sandbox';
import { buildingPlots } from './building-plots';
import {
	houseChunk,
	houseMassParts,
	massesOfChunk,
	massAt,
	storiesOf,
	type HouseUse,
	type Stacks
} from '../house-brush';
import { neighborsOf, type QuadCell } from '../quad-grid';
import type { Primitive } from '../parametrik/types';
import { present, type Focus } from '../presentation';
import type { SandboxState } from './state';
import type { World } from './world';

type Phase = Readonly<{ built: number; style: BuildingMethod }>;
type MutableStacks = Map<string, HouseUse[]>;

const phasesByState = new WeakMap<SandboxState, ReadonlyMap<Phase, Stacks>>();
const currentByState = new WeakMap<SandboxState, Stacks>();

function setFloor(stacks: MutableStacks, id: string, level: number, use: HouseUse) {
	const floors = stacks.get(id) ?? [];
	floors[level] = use;
	stacks.set(id, floors);
}

function groupPhases(state: SandboxState, stacks: Stacks, currentOnly = false) {
	const phases = new Map<Phase, MutableStacks>();
	const keys = new Map<string, Phase>();
	for (const [id, uses] of stacks) {
		uses.forEach((use, level) => {
			const part = state.storyParts.get(id)?.[level];
			if (!part || (currentOnly && part.built !== state.year)) return;
			const { built, style } = part;
			const key = `${built}/${style}`;
			const phase = keys.get(key) ?? { built, style };
			const floors = phases.get(phase) ?? new Map();
			setFloor(floors, id, level, use);
			keys.set(key, phase);
			phases.set(phase, floors);
		});
	}
	return phases;
}

/** Groups construction by year and saved style, retaining original floor indices. */
function constructionPhases(state: SandboxState): ReadonlyMap<Phase, Stacks> {
	const phases = phasesByState.get(state) ?? groupPhases(state, state.stacks);
	phasesByState.set(state, phases);
	return phases;
}

/** Current stories retain their original floor indices for the house massing grammar. */
export function currentStacks(state: SandboxState): Stacks {
	const cached = currentByState.get(state);
	if (cached) return cached;
	const current: MutableStacks = new Map();
	for (const [phase, stacks] of constructionPhases(state)) {
		if (phase.built !== state.year) continue;
		for (const [id, floors] of stacks)
			floors.forEach((use, level) => setFloor(current, id, level, use));
	}
	currentByState.set(state, current);
	return current;
}

// The form grammar also draws fragments as stock for the style study. A freshly painted
// volume is new work in the sandbox; its drafted line details can keep their own weight.
const newVolume = (part: Primitive): Primitive =>
	part.role === 'bestand' && part.kind !== 'polyline'
		? { ...part, role: 'neu', edges: true }
		: part;

/** Projects each layer with its saved geometry and the selected view's current or stock style. */
export function houseView(
	world: World,
	stacks: Stacks,
	chunk: string,
	focus: Focus,
	earliestFullYear = world.state.year
) {
	const { grid, state, seed } = world;
	const phases = [...constructionPhases(state)];
	const current =
		stacks === currentStacks(state)
			? phases.filter(([phase]) => phase.built === state.year)
			: [...groupPhases(state, stacks, true)];
	const stock = phases.filter(([phase]) => phase.built < earliestFullYear);
	const project = ([{ built, style }, floors]: (typeof phases)[number]) =>
		houseChunk(
			buildingPlots(grid),
			floors,
			chunk,
			seed,
			style,
			{
				occupied: state.stacks,
				// Plots already exclude passages; roof runs stay within the original lattice block.
				blockOf: (id) => grid.cellsById.get(id)?.block.split('/')[0],
				olderRoof: (id) => (state.storyParts.get(id)?.at(-1)?.built ?? Infinity) < built
			},
			world.roofBuilder
		);
	return [
		...present(stock.flatMap(project), focus.stock),
		...present(
			[
				...phases.filter(([phase]) => phase.built >= earliestFullYear && phase.built < state.year),
				...current
			]
				.flatMap(project)
				.map(newVolume),
			focus.houses
		)
	];
}

function houseGroupKey({ built, style }: Phase, id: string) {
	return `${built}/${style}/${id}`;
}

/** Mass addresses touching the supplied parcels or their facade neighbours. */
export function affectedHouseGroups(world: World, cellIds: Iterable<string>): Map<string, string> {
	const plots = buildingPlots(world.grid);
	const nearby = new Set<QuadCell>();
	for (const id of cellIds) {
		const cell = plots.cellsById.get(id);
		if (!cell) continue;
		nearby.add(cell);
		for (const neighbor of neighborsOf(plots, cell)) nearby.add(neighbor);
	}
	const out = new Map<string, string>();
	for (const [phase, stacks] of constructionPhases(world.state)) {
		const visited = new Set<string>();
		for (const cell of nearby) {
			storiesOf(stacks, cell.id).forEach((_, level) => {
				if (visited.has(`${cell.id}@${level}`)) return;
				const mass = massAt(plots, stacks, cell, level);
				for (const story of mass.stories) visited.add(`${story.cell.id}@${story.level}`);
				out.set(houseGroupKey(phase, mass.id), mass.stories[0].cell.chunk);
			});
		}
	}
	return out;
}

function presentHouseGroup(parts: Primitive[], phase: Phase, firstFullYear: number, focus: Focus) {
	if (phase.built < firstFullYear) return present(parts, focus.stock);
	return present(parts.map(newVolume), focus.houses);
}

/** Projects mass batches per chunk. A key filter skips primitive generation of other masses. */
export function houseGroups(
	world: World,
	chunk: string,
	focus: Focus,
	keys?: ReadonlySet<string>,
	firstFullYear = world.state.year
) {
	const { grid, state, seed } = world;
	const plots = buildingPlots(grid);
	const groups = new Map<string, Primitive[]>();
	for (const [phase, stacks] of constructionPhases(state)) {
		const context = {
			occupied: state.stacks,
			blockOf: (id: string) => grid.cellsById.get(id)?.block.split('/')[0],
			olderRoof: (id: string) => (state.storyParts.get(id)?.at(-1)?.built ?? Infinity) < phase.built
		};
		for (const mass of massesOfChunk(plots, stacks, chunk)) {
			const key = houseGroupKey(phase, mass.id);
			if (keys && !keys.has(key)) continue;
			const parts = houseMassParts(
				plots,
				stacks,
				mass,
				seed,
				phase.style,
				context,
				world.roofBuilder
			);
			groups.set(key, presentHouseGroup(parts, phase, firstFullYear, focus));
		}
	}
	return groups;
}
