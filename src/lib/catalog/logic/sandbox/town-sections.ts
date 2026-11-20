import { courtHouseFloor } from './court-house-floor';
import { plannedPlots } from './planned-ensembles';
import { required } from '../required';
import type { HouseUse } from '../house-brush';
import { buildingPlots } from './building-plots';
import { houseEnsembles, houseDistrict } from './house-ensembles';
import type { World } from './world';
import { paintedSections } from '../composed-house';

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
function planSections(world: World) {
	const plots = buildingPlots(world.grid),
		r3 = houseEnsembles(world.grid, plots, world.state, world.seed);
	const planned = plannedPlots(world.state);
	const sections = [...paintedRuns(world)].flatMap(([start, stacks]) =>
		paintedSections(plots, stacks, world.seed, {
			floorFor: (cell) => {
				const court = planned.has(cell.id) && r3.cells.get(cell.id)?.id;
				return start === 0 && court ? courtHouseFloor(world.grid, cell, court) : undefined;
			},
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
const plans = new WeakMap<World, ReturnType<typeof planSections>>();
/** Shares one house survey between the town ribbon and the house projection. */
export function townSections(world: World) {
	const saved = plans.get(world);
	if (saved) return saved;
	const plan = planSections(world);
	plans.set(world, plan);
	return plan;
}
