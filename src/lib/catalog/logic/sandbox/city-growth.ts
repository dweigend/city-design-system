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
function cityHouseStyle(world: World, plan: CityPlan, cell: TerrainCell) {
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

function peakUse(
	group: Centre['ensembles'][number] | undefined,
	id: string,
	seed: number
): HouseUse {
	if (group?.openingPlots === undefined || id !== group.lots[0]) return 'living';
	const uses = ['living', 'food', 'energy'] as const;
	return uses[Math.floor(hashUnit(seed, id, 'roof') * uses.length)];
}
function districtUses(centre: Centre | undefined, anchor: boolean, use: HouseUse) {
	const programme = centre?.dominantProgramme;
	return {
		use: programme ?? use,
		middle: anchor ? ('living' as const) : (programme ?? ('living' as const))
	};
}
function programme(world: World, plan: CityPlan, cell: TerrainCell) {
	const centre = plan.centres.find((c) => c.lots.includes(cell.id));
	const ensemble = centre?.ensembles?.find((g) => g.lots.includes(cell.id));
	const grouped = ensemble?.openingPlots !== undefined;
	const base = ensemble && (grouped || cell.id !== ensemble.lots[0]);
	const style =
		base && stylesForYear(world.state.year).includes('composed')
			? ('composed' as const)
			: cityHouseStyle(world, plan, cell);
	const uses: readonly HouseUse[] = ['living', 'food', 'water', 'material', 'energy'];
	const use =
		uses[Math.floor(hashUnit(world.seed, ensemble?.court ?? cell.id, 'city-use') * uses.length)];
	const roof = peakUse(ensemble, cell.id, world.seed);
	return { style, roof, ...districtUses(centre, ensemble?.lots[0] === cell.id, use) };
}

function buildLot(
	world: World,
	plan: CityPlan,
	height: number,
	cell: TerrainCell,
	construct: Construct
) {
	const { style, use, roof, middle } = programme(world, plan, cell);
	for (let floor = 0; floor < height; floor++)
		world = construct(world, {
			kind: 'raise',
			cellId: cell.id,
			use: floor === 0 ? use : floor === height - 1 ? roof : middle,
			style
		});
	return world;
}

function released(centre: Centre, stage: number, next: number, seed: number) {
	// Existing saves retain their original release order and seeded heights.
	if (!centre.ensembles)
		return centre.lots.slice(cohortEnds[stage], cohortEnds[next]).map((id) => ({
			id,
			height:
				(hashUnit(seed, id, 'city-typology') < centre.towerShare ? 5 : 1) +
				Math.floor(hashUnit(seed, id, 'city-height') * 3)
		}));
	return centre.ensembles.flatMap((g) => {
		const end = (n: number) =>
			n === 0 ? 0 : g.openingPlots === undefined ? n + 2 : g.openingPlots + Math.max(0, n - 2);
		const start = end(stage);
		return g.lots.slice(start, end(next)).map((id, i) => ({ id, height: g.heights[start + i] }));
	});
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
		for (const { id, height } of released(centre, stage, next, world.seed)) {
			const cell = world.grid.cellsById.get(id);
			if (cell?.buildable && !reserved.has(id))
				world = buildLot(world, city, height, cell, construct);
		}
		return next;
	});
	return { ...world, state: { ...world.state, cityStages: stages } };
}
