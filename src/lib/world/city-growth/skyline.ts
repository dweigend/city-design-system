import { districtLevels, maximumLevelStep } from '../../domain/city-volume';
import { TerrainGrid } from '../../domain/terrain-grid';
import { readCityDistricts, riverCityRecipe } from '../city-site';
import type { GrowthCarrier } from './carrier';
import type { createStock } from './history';
import type { CityGrowthBuilding, CityGrowthHolding } from './types';

type Stock = ReturnType<typeof createStock>;
type DistrictHolding = Pick<CityGrowthHolding, 'id' | 'memberCellIds'>;

export function readBuildingStoreys({ parts }: CityGrowthBuilding) {
	const storeys = parts.filter(({ kind }) => kind === 'storey').map(({ datumIndex }) => datumIndex);
	return storeys.length ? Math.max(...storeys) - Math.min(...storeys) + 1 : 0;
}

function readStoreysPerLevel(carrier: GrowthCarrier) {
	return (carrier.site.recipe ?? riverCityRecipe).storeysPerLevel;
}

export function readStoreyCaps(carrier: GrowthCarrier, stock: Stock, pending?: DistrictHolding) {
	const storeysPerLevel = readStoreysPerLevel(carrier);
	const detachedStoreys = districtLevels.detached * storeysPerLevel;
	const neighborStepStoreys = maximumLevelStep * storeysPerLevel;
	const ranked = new Set<string>();
	const roofByCell = new Map<string, number>();
	for (const [id, building] of stock.buildings) {
		const roof = readBuildingStoreys(building);
		for (const cell of stock.holdings.get(id)?.memberCellIds ?? []) {
			ranked.add(cell);
			roofByCell.set(cell, Math.max(roof, roofByCell.get(cell) ?? 0));
		}
	}
	for (const cell of pending?.memberCellIds ?? []) ranked.add(cell);
	const rankedCellIds = [...ranked];
	const futureFringe = rankedCellIds.filter((id) =>
		carrier.neighborsByCell
			.get(id)
			?.some(
				(neighbor) =>
					neighbor !== null && carrier.neighborsByCell.has(neighbor) && !ranked.has(neighbor)
			)
	);
	const grid = TerrainGrid.select(carrier.layout.grid, rankedCellIds);
	const districts = readCityDistricts(
		carrier.site,
		{
			grid,
			growth: { planScope: carrier.planScope, rankedCellIds, futureFringe }
		},
		carrier.layout.seed
	);
	return (holding: DistrictHolding) => {
		let cap = Infinity;
		for (const cell of holding.memberCellIds) {
			const district = ranked.has(cell) ? districts.cell(cell) : undefined;
			cap = Math.min(cap, district ? district.levels * storeysPerLevel : detachedStoreys);
			for (const neighbor of carrier.neighborsByCell.get(cell) ?? []) {
				if (neighbor === null || holding.memberCellIds.includes(neighbor)) continue;
				const roof = roofByCell.get(neighbor);
				if (roof !== undefined) cap = Math.min(cap, roof + neighborStepStoreys);
			}
		}
		return cap;
	};
}

export function limitInitialStoreys(
	carrier: GrowthCarrier,
	stock: Stock,
	candidate: DistrictHolding,
	requested: number
) {
	const detachedStoreys = districtLevels.detached * readStoreysPerLevel(carrier);
	if (requested <= detachedStoreys) return requested;
	return Math.min(requested, readStoreyCaps(carrier, stock, candidate)(candidate));
}
