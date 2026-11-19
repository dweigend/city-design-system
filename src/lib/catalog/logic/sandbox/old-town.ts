import { townDefaults } from '../../data/sandbox';
import type { StoryPart } from './state';
import { hashUnit } from '../parzelle';
import { type TerrainGrid } from '../terrain-grid';
import { neighborsOf } from '../quad-grid';
import type { HouseUse } from '../house-brush';
import { EMPTY_STATE, styleForYear } from './state';

export type TownOptions = Partial<typeof townDefaults>;

/** Assigns lots to the nearest public frontage along actual parcel sides. */
function frontageLots(grid: TerrainGrid, depthLimit: number) {
	let front = grid.cells
		.filter((c) => c.alley && !c.plan.open)
		.map((cell) => ({ cell, lot: cell.id }));
	const sites = new Map<string, { lot: string; depth: number }>();
	for (let depth = 1; depth <= depthLimit; depth++) {
		front = front.flatMap(({ cell, lot }) =>
			neighborsOf(grid, cell).flatMap((next) => {
				if (!next.buildable || next.zone !== 'lower-terrace' || sites.has(next.id)) return [];
				sites.set(next.id, { lot, depth });
				return [{ cell: next, lot }];
			})
		);
	}
	return sites;
}

/** Paired alley-front lots on the first dry terrace. Parcel-addressed draws leave alleys and gardens. */
export function seedTown(grid: TerrainGrid, options: TownOptions = {}) {
	const settings = { ...townDefaults, ...options };
	const frontages = frontageLots(grid, settings.frontageDepth);
	const seed = grid.terrain.seed;
	const center =
		grid.columns * (settings.centerMin + settings.centerRange * hashUnit(seed, 'town'));
	const sites = grid.cells.filter((c) => c.buildable && c.zone === 'lower-terrace');
	const shore = sites.find((c) => Math.abs(c.column - center) < 1)?.row ?? grid.rows / 3;
	const lots = sites
		.flatMap((cell) => {
			const frontage = frontages.get(cell.id);
			if (!frontage) return [];
			const { lot, depth } = frontage;
			if (hashUnit(seed, cell.block, 'garden') < settings.gardenShare) return [];
			const score =
				Math.hypot(
					(cell.column - center) / settings.alongScale,
					cell.row - shore - settings.inlandRows
				) +
				depth * settings.depthPenalty;
			return [
				{
					cell,
					score,
					height: 1 + Math.floor(hashUnit(seed, lot, 'height') * settings.maxFloors)
				}
			];
		})
		.sort((a, b) => a.score - b.score);
	const stacks = new Map<string, HouseUse[]>(),
		storyParts = new Map<string, StoryPart[]>();
	const built = Math.min(settings.stockYear, settings.year - 1);
	let slot = 0;
	for (const { cell, height } of lots.slice(0, settings.cells)) {
		stacks.set(cell.id, Array<HouseUse>(height).fill('living'));
		storyParts.set(
			cell.id,
			Array.from({ length: height }, (_, level) => ({
				id: 'p/0/' + slot++,
				anchor: { cellId: cell.id, level },
				built,
				style: styleForYear(built)
			}))
		);
	}
	const cover = new Map<string, 'meadow'>();
	for (const { cell } of lots.slice(0, settings.cells)) {
		for (const neighbor of neighborsOf(grid, cell)) {
			if (
				neighbor.plantable &&
				!stacks.has(neighbor.id) &&
				hashUnit(seed, neighbor.id, 'planting') < settings.gardenShare
			)
				cover.set(neighbor.id, 'meadow');
		}
	}
	const timeLayers = stacks.size
		? [{ year: built, flows: ['people'] as const }]
		: EMPTY_STATE.timeLayers;
	return { ...EMPTY_STATE, year: settings.year, stacks, storyParts, cover, timeLayers };
}
