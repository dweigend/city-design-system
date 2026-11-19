import { networkGroups } from './network-groups';
import { nextSeed } from '../../core/random';
import { required } from '../required';
import { isPainted } from './house-phase-ink';
import { houseObstacles } from './house-obstacles';
import { paintedSections, sectionGroups } from '../composed-house';
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
function survey(world: World) {
	const plots = buildingPlots(world.grid),
		r3 = houseEnsembles(world.grid, plots, world.state, world.seed);
	const sections = [...paintedRuns(world)].flatMap(([start, stacks]) =>
		paintedSections(plots, stacks, world.seed, {
			seedFor: (id) => world.state.storyParts.get(id)?.[start]?.houseSeed,
			// The shared-wall graph limits bodies. R3's lateral graph also includes across-alley neighbours.
			joined: (a, b) => r3.cells.get(a)?.neighbors.includes(b) ?? false,
			district: (id) => houseDistrict(required(world.grid.cellsById.get(id), 'painted cell'))
		})
	);
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
					seed: s.seed,
					built: Math.max(...stories.map((p) => p.built)),
					painted: stories.some((p) => isPainted(p.id))
				}
			] as const;
		})
	);
	const stock = houseObstacles(world.grid, world.state);
	return [
		...sectionGroups(world.grid, sections, world.seed, stock),
		...networkGroups(world, sections, r3, stock)
	].map((g) => {
		const owners = g.owners.map((id) => required(phases.get(id), 'section owner'));
		return {
			...g,
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

/** A third parcel can divert or remove a span without changing either endpoint. */
export function changedSpans(before: World, after: World) {
	const spans = (w: World) =>
		new Map(
			composedProjection(w)
				.filter((g) => g.span)
				.map((g) => [g.id, g])
		);
	const old = spans(before),
		next = spans(after),
		changes = new Map<string, string>();
	for (const [id, g] of old)
		if (g.span !== next.get(id)?.span) changes.set('composed/' + id, g.chunk);
	for (const [id, g] of next)
		if (g.span !== old.get(id)?.span) changes.set('composed/' + id, g.chunk);
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
