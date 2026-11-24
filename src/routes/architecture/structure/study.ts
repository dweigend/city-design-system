import type { Vec3 } from '../../../lib/core/geometry';
import { createCityLattice, type LatticeVariant } from '../../../lib/domain/city-volume';
import {
	projectCityDistricts,
	projectCityTerrain
} from '../../../lib/scene/city-volume-projection';
import { structureProjectionDefaults } from '../../../lib/scene/structure-projection';
import { stockSurfaces } from '../../../lib/scene/surface';
import { createCityStructure, structureTownExample } from '../../../lib/world/city-structure';

export function townStudy() {
	const { city, layout, columns, quarter } = structureTownExample();
	const terrain = projectCityTerrain(city, layout.grid, layout.plan);
	const toLocal = ([x, y, z]: Vec3): Vec3 => [...terrain.toLocal(x, y), z];
	return {
		terrain,
		toLocal,
		build: (model: LatticeVariant, town: boolean) => {
			const selected = town ? columns : quarter;
			const lattice = createCityLattice(selected, layout.datumZ, model);
			return createCityStructure(lattice, layout.datumZ);
		},
		stock: () => {
			const { drawables } = projectCityDistricts(columns, layout.datumZ, terrain);
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
