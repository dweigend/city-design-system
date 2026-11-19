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
			floors[i] = world.state.stacks.get(id)![i];
			level.set(id, floors);
			runs.set(start, level);
		});
	}
	return runs;
}
function survey(world: World) {
	const plots = buildingPlots(world.grid),
		r3 = houseEnsembles(world.grid, plots, world.state, world.seed);
	const sections = [...paintedRuns(world)].flatMap(([, stacks]) =>
		paintedSections(plots, stacks, world.seed, {
			// The shared-wall graph limits bodies. R3's lateral graph also includes across-alley neighbours.
			joined: (a, b) => r3.cells.get(a)?.neighbors.includes(b) ?? false,
			district: (id) => houseDistrict(world.grid.cellsById.get(id)!)
		})
	);
	const phases = new Map(
		sections.map((s) => {
			const stories = s.cells.flatMap((c) =>
				world.state.storyParts.get(c.id)!.slice(s.start, s.start + s.stories)
			);
			return [
				s.id,
				{
					built: Math.max(...stories.map((p) => p.built)),
					painted: stories.some((p) => isPainted(p.id))
				}
			] as const;
		})
	);
	return sectionGroups(world.grid, sections, world.seed, houseObstacles(plots, world.state)).map(
		(g) => {
			const owners = g.owners.map((id) => phases.get(id)!);
			return {
				...g,
				built: Math.max(...owners.map((p) => p.built)),
				painted: owners.some((p) => p.painted)
			};
		}
	);
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
