import type { Vec3 } from '../../../lib/core/geometry';
import {
	createCityLattice,
	readCityColumns,
	type LatticeVariant
} from '../../../lib/domain/city-volume';
import {
	projectCityDistricts,
	projectCityTerrain
} from '../../../lib/scene/city-volume-projection';
import { structureProjectionDefaults } from '../../../lib/scene/structure-projection';
import { stockSurfaces } from '../../../lib/scene/surface';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid,
	riverCityRecipe
} from '../../../lib/world/city-site';
import { createCityStructure, readStructureQuarter } from '../../../lib/world/city-structure';

export function townStudy() {
	const city = createCitySite();
	const layout = readCityGrid(city, citySiteParams.citySize.default);
	const columns = readCityColumns(layout.grid, readCityDistricts(city, layout));
	const quarter = readStructureQuarter(columns);
	const recipe = city.recipe ?? riverCityRecipe;
	const terrain = projectCityTerrain(city, layout.grid, layout.plan);
	const toLocal = ([x, y, z]: Vec3): Vec3 => [...terrain.toLocal(x, y), z];
	return {
		terrain,
		toLocal,
		build: (model: LatticeVariant, town: boolean) => {
			const selected = town ? columns : quarter;
			const lattice = createCityLattice(selected, layout.datumZ, model, recipe);
			return createCityStructure(lattice, layout.datumZ, recipe.levelHeightM);
		},
		stock: () => {
			const { drawables } = projectCityDistricts(
				columns,
				layout.datumZ,
				terrain,
				undefined,
				undefined,
				undefined,
				recipe.levelHeightM
			);
			return drawables.flatMap((part) => {
				if (part.role === 'block') {
					return [
						{
							...part,
							color: stockSurfaces.veil.color,
							fillAlpha: structureProjectionDefaults.stockFillOpacity,
							stroke: part.stroke && {
								...part.stroke,
								color: stockSurfaces.veil.stroke,
								opacity: structureProjectionDefaults.stockStrokeOpacity
							}
						}
					];
				}
				return [];
			});
		}
	};
}
