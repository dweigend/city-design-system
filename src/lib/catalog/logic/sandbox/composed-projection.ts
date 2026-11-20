import { plannedPlots } from './planned-ensembles';
import { networkGroups } from './network-groups';
import { nextSeed } from '../../core/random';
import { required } from '../required';
import { isPainted } from './house-phase-ink';
import { houseObstacles } from './house-obstacles';
import { accentBody, accentKind, paintedSections, sectionGroups } from '../composed-house';
import type { HouseUse } from '../house-brush';
import { buildingPlots } from './building-plots';
import { houseEnsembles, houseDistrict } from './house-ensembles';
import type { World } from './world';

function paintedRuns(world: World) {
	const runs = new Map<number, Map<string, HouseUse[]>>();
	for (const [id, parts] of world.state.storyParts) {
		let start = 0;
		parts.forEach((part, i) => {
			if (part.style !== 'composed') {
				start = i + 1;
				return;
			}
			const level = runs.get(start) ?? new Map<string, HouseUse[]>(),
				floors = level.get(id) ?? [];
			floors[i] = required(world.state.stacks.get(id), 'painted stack')[i];
			level.set(id, floors);
			runs.set(start, level);
		});
	}
	return runs;
}
/** Plans the constructed house sections from the saved story runs and town layout. */
export function townSections(world: World) {
	const plots = buildingPlots(world.grid),
		r3 = houseEnsembles(world.grid, plots, world.state, world.seed);
	const planned = plannedPlots(world.state);
	const sections = [...paintedRuns(world)].flatMap(([start, stacks]) =>
		paintedSections(plots, stacks, world.seed, {
			courtFor: (id) => (planned.has(id) ? r3.cells.get(id)?.id : undefined),
			seedFor: (id) => world.state.storyParts.get(id)?.[start]?.houseSeed,
			// The shared-wall graph limits bodies. R3's lateral graph also includes across-alley neighbours.
			joined: (a, b) =>
				!planned.has(a) && !planned.has(b) && (r3.cells.get(a)?.neighbors.includes(b) ?? false),
			district: (id) => houseDistrict(required(world.grid.cellsById.get(id), 'painted cell'))
		})
	);
	return { sections, layout: r3 };
}
function survey(world: World) {
	const { sections, layout: r3 } = townSections(world);
	const phases = new Map(
		sections.map((s) => {
			const stories = s.cells.flatMap((c) =>
				required(world.state.storyParts.get(c.id), 'construction phase').slice(
					s.start,
					s.start + s.stories
				)
			);
			return [
				s.id,
				{
					start: s.start,
					appearance: JSON.stringify([
						s.composition.role,
						s.composition.sharedRoof,
						s.composition.exterior?.system,
						s.composition.shellUse,
						s.composition.exterior?.seams,
						accentKind(s),
						accentBody(s).id
					]),
					seed: s.seed,
					built: Math.max(...stories.map((p) => p.built)),
					painted: stories.some((p) => isPainted(p.id))
				}
			] as const;
		})
	);
	const planned = plannedPlots(world.state);
	const stock = houseObstacles(world.grid, world.state);
	return [
		...sectionGroups(world.grid, sections, world.seed, stock).filter(
			(g) => !g.span || !g.cells.some((id) => planned.has(id))
		),
		...networkGroups(world, sections, r3, stock).map((g) => ({ ...g, planningCells: g.cells }))
	].map((g) => {
		const owners = g.owners.map((id) => required(phases.get(id), 'section owner'));
		return {
			...g,
			signature: g.span || owners[0].appearance,
			start: owners[0].start,
			seed: owners[0].seed,
			built: Math.max(...owners.map((p) => p.built)),
			painted: owners.some((p) => p.painted)
		};
	});
}
const projections = new WeakMap<World, ReturnType<typeof survey>>();
/** Surveys whole composed runs across build years, including links between different generations. */
export function composedProjection(world: World) {
	const saved = projections.get(world);
	if (saved) return saved;
	const groups = survey(world);
	projections.set(world, groups);
	return groups;
}

/** A neighbour can acquire a different ensemble role or divert a span without a local edit. */
export function changedProjectionGroups(before: World, after: World) {
	const index = (world: World) => new Map(composedProjection(world).map((g) => [g.id, g]));
	const old = index(before),
		next = index(after);
	const changes = new Map<string, string>();
	for (const [id, g] of old)
		if (g.signature !== next.get(id)?.signature) changes.set('composed/' + id, g.chunk);
	for (const [id, g] of next)
		if (g.signature !== old.get(id)?.signature) changes.set('composed/' + id, g.chunk);
	return changes;
}

/** Lists stable house addresses available for individual regeneration. */
export function composedHouseIds(world: World) {
	return composedProjection(world)
		.filter((g) => !g.span)
		.map((g) => g.id);
}

/** Draws the next house seed on its supporting stories, preserving paint, height and neighbours. */
export function regenerateHouse(world: World, id: string): World {
	const house = composedProjection(world).find((g) => !g.span && g.id === id);
	if (!house) return world;
	const seed = nextSeed(house.seed),
		storyParts = new Map(world.state.storyParts);
	for (const cell of house.cells) {
		const parts = required(storyParts.get(cell), 'painted house');
		storyParts.set(
			cell,
			parts.map((p, i) => (i === house.start ? { ...p, houseSeed: seed } : p))
		);
	}
	return { ...world, state: { ...world.state, storyParts } };
}
