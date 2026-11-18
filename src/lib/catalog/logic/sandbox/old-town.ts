import { townDefaults } from '../../data/sandbox';
import type { StoryPart } from './state';
import { DEFAULT_RULES, hashUnit } from '../parzelle';
import { BLOCK, MODULE, type TerrainGrid } from '../terrain-grid';
import type { HouseUse } from '../house-brush';
import { EMPTY_STATE } from './state';

export type TownOptions = Partial<typeof townDefaults>;

/** Paired street-front lots on the first dry terrace. Parcel-addressed draws leave alleys and gardens. */
export function seedTown(grid: TerrainGrid, options: TownOptions = {}) {
	const settings = { ...townDefaults, ...options };
	const frontage = Math.max(1, Math.round(DEFAULT_RULES.frontTarget / MODULE));
	const seed = grid.terrain.seed;
	const center =
		grid.columns * (settings.centerMin + settings.centerRange * hashUnit(seed, 'town'));
	const sites = grid.cells.filter((c) => c.buildable && c.zone === 'lower-terrace');
	const shore = sites.find((c) => Math.abs(c.column - center) < 1)?.row ?? grid.rows / 3;
	const lots = sites
		.flatMap((cell) => {
			const r = cell.row % BLOCK.rows;
			const depth = Math.min(r, BLOCK.rows - r);
			if (depth > settings.frontageDepth) return [];
			const lot = [
				cell.block,
				Math.floor(((cell.column % BLOCK.columns) - 1) / frontage),
				r < BLOCK.rows / 2 ? 0 : 1
			];
			if (hashUnit(seed, ...lot, 'garden') < settings.gardenShare) return [];
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
					height: 1 + Math.floor(hashUnit(seed, ...lot, 'height') * settings.maxFloors)
				}
			];
		})
		.sort((a, b) => a.score - b.score);
	const stacks = new Map<string, HouseUse[]>(),
		storyParts = new Map<string, StoryPart[]>();
	let slot = 0;
	for (const { cell, height } of lots.slice(0, settings.cells)) {
		stacks.set(cell.id, Array<HouseUse>(height).fill('living'));
		storyParts.set(
			cell.id,
			Array.from({ length: height }, (_, level) => ({
				id: 'p/0/' + slot++,
				anchor: { cellId: cell.id, level },
				built: Math.min(settings.stockYear, settings.year - 1)
			}))
		);
	}
	return { ...EMPTY_STATE, year: settings.year, stacks, storyParts };
}
