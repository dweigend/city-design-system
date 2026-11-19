import { composedProjection } from './composed-projection';
import type { BuildingMethod } from '../../data/sandbox';
import { buildingPlots } from './building-plots';
import {
	houseChunk,
	houseMassParts,
	massesOfChunk,
	massAt,
	massStoryKeys,
	wallEnsembles,
	storiesOf,
	type HouseUse,
	type Stacks
} from '../house-brush';
import { neighborsOf, type QuadCell } from '../quad-grid';
import type { Primitive } from '../parametrik/types';
import { present, type Focus } from '../presentation';
import type { SandboxState } from './state';
import type { World } from './world';
import { ensembleEditCells, ensembleFloors, houseEnsembles } from './house-ensembles';
import { isColourBuild, isPainted, presentHouseGroup } from './house-phase-ink';

type Phase = Readonly<{ built: number; style: BuildingMethod; painted: boolean }>;
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
			const painted = isPainted(part.id);
			const key = `${built}/${style}/${painted}`;
			const phase = keys.get(key) ?? { built, style, painted };
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

function printOrder(state: SandboxState, earliestFullYear?: number) {
	return (cell: QuadCell, level: number) => {
		const story = state.storyParts.get(cell.id)?.[level];
		if (
			story?.style !== 'collage' ||
			!isColourBuild({ built: story.built, painted: isPainted(story.id) }, earliestFullYear)
		)
			return;
		const [, action, slot] = story.id.split('/');
		return Number(action) + Number(slot) / (Number(slot) + 1) || 0;
	};
}

const visualPhases = new WeakMap<ReturnType<typeof houseEnsembles>, WeakMap<Stacks, Stacks>>();

function visualFloors(stacks: Stacks, occupied: Stacks, layout: ReturnType<typeof houseEnsembles>) {
	const phases = visualPhases.get(layout) ?? new WeakMap<Stacks, Stacks>();
	visualPhases.set(layout, phases);
	const floors = phases.get(stacks) ?? ensembleFloors(stacks, occupied, layout);
	phases.set(stacks, floors);
	return floors;
}

function houseProjection(world: World) {
	const plots = buildingPlots(world.grid);
	const ensembles = houseEnsembles(world.grid, plots, world.state, world.seed);
	const occupied = visualFloors(world.state.stacks, world.state.stacks, ensembles);
	return { plots, ensembles, occupied };
}

/** Projects each layer with its saved geometry and the selected view's colour or stock style. */
export function houseView(
	world: World,
	stacks: Stacks,
	chunk: string,
	focus: Focus,
	earliestFullYear?: number
) {
	const { grid, state, seed } = world;
	const { plots, ensembles, occupied } = houseProjection(world);
	const phases = [...constructionPhases(state)];
	const current =
		stacks === currentStacks(state)
			? phases.filter(([phase]) => phase.built === state.year)
			: [...groupPhases(state, stacks, true)];
	const project = ([{ built, style, painted }, floors]: (typeof phases)[number]) =>
		style === 'composed'
			? []
			: houseChunk(
					plots,
					visualFloors(floors, state.stacks, ensembles),
					chunk,
					seed,
					style,
					{
						occupied,
						ensembles: painted ? ensembles : undefined,
						printOrder: printOrder(state, earliestFullYear),
						// Plots already exclude passages; roof runs stay within the original lattice block.
						blockOf: (id) => grid.cellsById.get(id)?.block.split('/')[0],
						olderRoof: (id) => (state.storyParts.get(id)?.at(-1)?.built ?? Infinity) < built
					},
					world.roofBuilder
				);
	const stock = phases.filter(([phase]) => !isColourBuild(phase, earliestFullYear));
	const colour = [...phases.filter(([phase]) => phase.built < state.year), ...current].filter(
		([phase]) => isColourBuild(phase, earliestFullYear)
	);
	return [
		...composedProjection(world)
			.filter(
				(g) => g.chunk === chunk && (g.built !== state.year || g.cells.some((id) => stacks.has(id)))
			)
			.flatMap((g) => presentHouseGroup(g.parts(), g, state.year, focus, earliestFullYear)),
		...present(stock.flatMap(project), focus.stock),
		...colour.flatMap((entry) =>
			presentHouseGroup(project(entry), entry[0], state.year, focus, earliestFullYear)
		)
	];
}

const houseGroupKey = ({ built, style }: Phase, id: string) => `${built}/${style}/${id}`;

/** Mass addresses touching the supplied parcels or their facade neighbours. */
export function affectedHouseGroups(world: World, cellIds: Iterable<string>): Map<string, string> {
	const { plots, ensembles } = houseProjection(world);
	const edits = new Set(cellIds);
	const nearby = new Set<QuadCell>();
	for (const id of ensembleEditCells(world.grid, ensembles, edits)) {
		const cell = plots.cellsById.get(id);
		if (!cell) continue;
		nearby.add(cell);
		for (const neighbor of neighborsOf(plots, cell)) nearby.add(neighbor);
	}
	const out = new Map<string, string>();
	for (const g of composedProjection(world))
		if (g.cells.some((id) => edits.has(id))) out.set('composed/' + g.id, g.chunk);
	for (const [phase, painted] of constructionPhases(world.state)) {
		if (phase.style === 'composed') continue;
		const stacks = visualFloors(painted, world.state.stacks, ensembles);
		const layout = phase.painted ? wallEnsembles(phase.style, { ensembles }) : undefined;
		const visited = new Set<string>();
		for (const cell of nearby) {
			storiesOf(stacks, cell.id).forEach((_, level) => {
				if (visited.has(`${cell.id}@${level}`)) return;
				const mass = massAt(plots, stacks, cell, level, layout);
				for (const key of massStoryKeys(mass)) visited.add(key);
				out.set(houseGroupKey(phase, mass.id), mass.stories[0].cell.chunk);
			});
		}
	}
	return out;
}

/** Projects mass batches per chunk. A key filter skips primitive generation of other masses. */
export function houseGroups(
	world: World,
	chunk: string,
	focus: Focus,
	keys?: ReadonlySet<string>,
	earliestFullYear?: number
) {
	const { grid, state, seed } = world;
	const { plots, ensembles, occupied } = houseProjection(world);
	const groups = new Map<string, Primitive[]>();
	addComposedGroups();
	for (const [phase, painted] of constructionPhases(state)) {
		if (phase.style === 'composed') continue;
		const stacks = visualFloors(painted, state.stacks, ensembles);
		const context = {
			occupied,
			ensembles: phase.painted ? ensembles : undefined,
			printOrder: printOrder(state, earliestFullYear),
			blockOf: (id: string) => grid.cellsById.get(id)?.block.split('/')[0],
			olderRoof: (id: string) => (state.storyParts.get(id)?.at(-1)?.built ?? Infinity) < phase.built
		};
		for (const mass of massesOfChunk(plots, stacks, chunk, wallEnsembles(phase.style, context))) {
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
			groups.set(key, presentHouseGroup(parts, phase, state.year, focus, earliestFullYear));
		}
	}
	return groups;

	function addComposedGroups() {
		for (const g of composedProjection(world)) {
			const key = 'composed/' + g.id;
			if (g.chunk === chunk && (!keys || keys.has(key)))
				groups.set(key, presentHouseGroup(g.parts(), g, state.year, focus, earliestFullYear));
		}
	}
}
