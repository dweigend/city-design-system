import { walkingSampler } from './network-terrain';
import { cityCorridorPlan } from './city-corridors';
import { openHousePassage } from '../composed-house';
import { townSections } from './town-sections';
export { townSections } from './town-sections';
import { seatedHouse } from './house-ground';
import { plannedPlots } from './planned-ensembles';
import { networkGroups } from './network-groups';
import { nextSeed } from '../../core/random';
import { required } from '../required';
import { isPainted } from './house-phase-ink';
import { houseObstacles } from './house-obstacles';
import { accentBody, accentKind, fieldUse, sectionGroups } from '../composed-house';
import { houseThreshold } from '../house-structure';
import type { World } from './world';

type Layout = ReturnType<typeof townSections>;
/** The court a ground house stands on and the threshold it opens to that court. */
function courtDoor(house: Layout['sections'][number] | undefined, layout: Layout['layout']) {
	const court = house && !house.start && layout.cells.get(house.cells[0].id)?.id;
	const port = house && houseThreshold(house.composition.structure);
	return court && port ? { court, port } : undefined;
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
						fieldUse(s),
						s.composition.exterior?.seams,
						s.composition.ground,
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
	const passages = cityCorridorPlan(world)?.plan.passages;
	const houses = new Map(sections.map((s) => [s.id, s]));
	return [
		...sectionGroups(world.grid, sections, world.seed, stock, walkingSampler(world.grid)).filter(
			(g) => !g.span || !g.cells.some((id) => planned.has(id))
		),
		...networkGroups(world, sections, r3, stock).map((g) => ({
			...g,
			movement: g.graph,
			planningCells: g.cells
		}))
	].map((g) => {
		const owners = g.owners.map((id) => required(phases.get(id), 'section owner'));
		const onGround = !g.span && owners[0].start === 0;
		const cells = g.cells.map((id) => required(world.grid.cellsById.get(id), 'foundation parcel'));
		const house = houses.get(g.id);
		const passage = house && passages?.get(house.id);
		const parts = () => {
			const members = g.parts();
			if (!onGround || !house) return members;
			const seated = seatedHouse(members, cells, world.grid, house.composition.exterior?.bottom, {
				slot: 'shell',
				use: fieldUse(house),
				ensemble: house.ensemble
			});
			return passage ? openHousePassage(house, passage, seated) : seated;
		};
		return {
			...g,
			door: courtDoor(planned.has(g.cells[0]) ? house : undefined, r3),
			passage,
			parts,
			signature: g.span || owners[0].appearance + JSON.stringify(passage?.centreline ?? []),
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
