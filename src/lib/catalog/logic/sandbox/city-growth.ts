import { weightedForm } from '../../core/neighbourhood';
import { hashUnit } from '../../core/random';
import { styleWeightsAt, type CityPlan } from '../city-plan';
import type { HouseUse } from '../house-brush';
import { cellsBetween, type TerrainCell } from '../terrain-grid';
import { stylesForYear, type Edit } from './state';
import type { World } from './world-contract';

type Centre = CityPlan['centres'][number];
type Construct = (world: World, edit: Edit) => World;
const cohortEnds = [0, 4, 10, 17, 24];

/** Draws a method once per footprint from its district and the current epoch. */
export function cityHouseStyle(world: World, plan: CityPlan, cell: TerrainCell) {
	const weights = styleWeightsAt(plan, cell);
	const choices = stylesForYear(world.state.year);
	if (choices.length === 1) return choices[0];
	let end = 0;
	const candidates = choices.flatMap((form) => {
		if (form === 'terrace' || form === 'collage') return [];
		end += weights[form];
		return [{ form, end }];
	});
	return weightedForm(candidates, world.seed, cell.id, 'city-house-style');
}

function occupied(world: World) {
	const { state } = world;
	return new Set([
		...state.stacks.keys(),
		...state.cover.keys(),
		...(state.spongeWorks ?? []).map((work) => work.cellId),
		...state.lines.flatMap((line) =>
			line.cellIds.flatMap((id, i) =>
				i ? cellsBetween(world.grid, line.cellIds[i - 1], id).map((c) => c.id) : [id]
			)
		),
		...[...state.parts.values()].flatMap((p) =>
			p.kind === 'segment' ? [p.anchor.cellId, p.end.cellId] : [p.anchor.cellId]
		)
	]);
}

function buildLot(
	world: World,
	plan: CityPlan,
	centre: Centre,
	cell: TerrainCell,
	construct: Construct
) {
	const style = cityHouseStyle(world, plan, cell);
	const tower = hashUnit(world.seed, cell.id, 'city-typology') < centre.towerShare;
	const height = (tower ? 5 : 1) + Math.floor(hashUnit(world.seed, cell.id, 'city-height') * 3);
	const uses: readonly HouseUse[] = ['living', 'food', 'water', 'material', 'energy'];
	const use = uses[Math.floor(hashUnit(world.seed, cell.id, 'city-use') * uses.length)];
	for (let floor = 0; floor < height; floor++)
		world = construct(world, {
			kind: 'raise',
			cellId: cell.id,
			use: floor === 0 ? use : 'living',
			style
		});
	return world;
}

/** Advances each expansion area's saved stage once, building only its newly released
 * dry lots. Earlier cohorts stay editable, including lots the player has cleared. */
export function growCity(world: World, construct: Construct, opening = false): World {
	const { city, cityStages } = world.state;
	if (!city || !cityStages) return world;
	if (cityStages.every((stage) => stage === cohortEnds.length - 1)) return world;
	const reserved = occupied(world);
	const stages = city.centres.map((centre, i) => {
		const stage = cityStages[i];
		const next = Math.min(stage + 1 + Number(opening && i === 0), cohortEnds.length - 1);
		for (const id of centre.lots.slice(cohortEnds[stage], cohortEnds[next])) {
			const cell = world.grid.cellsById.get(id);
			if (cell?.buildable && !reserved.has(id))
				world = buildLot(world, city, centre, cell, construct);
		}
		return next;
	});
	return { ...world, state: { ...world.state, cityStages: stages } };
}
