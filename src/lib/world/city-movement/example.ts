import type { Vec2 } from '../../core/geometry';
import { readCityColumns, type CityPlanVariant } from '../../domain/city-volume';
import { citySiteParams, createCitySite, readCityDistricts, readCityGrid } from '../city-site';
import { cityRailTerrainSlopeBound, readCityMovement, readCityRail } from './index';

/** Builds a seeded valley settlement with walkway centres and rail catchments supplied by the caller. */
export function cityMovementExample(
	variant: CityPlanVariant = 'organic',
	size = citySiteParams.citySize.default as number,
	relief?: number,
	useCrossing = true
) {
	const site = createCitySite(undefined, relief === undefined ? undefined : { relief });
	const layout = readCityGrid(site, size, variant);
	const columns = readCityColumns(layout.grid, readCityDistricts(site, layout));
	const heads = useCrossing
		? (layout.selectedCrossings[0]?.heads.map(({ nodeId }) => nodeId) ?? [])
		: [];
	const point = layout.grid.vertices.find(({ id }) => id === heads[0])?.position;
	const center: Vec2 = point ? [point[0], point[1]] : site.origin;
	const rail = readCityRail(site, layout, columns, {
		center,
		catchments: [
			{ id: 'north', center: [center[0], center[1] + 350] },
			{ id: 'south', center: [center[0], center[1] - 350] }
		],
		readSpanUpperM(a, b) {
			const surface = (x: number, y: number) => {
				const ground = site.sampleGround(x, y);
				return Math.max(ground.height, ground.waterHeight ?? -Infinity);
			};
			return (
				Math.max(surface(...a), surface(...b), surface((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) +
				(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4) * cityRailTerrainSlopeBound
			);
		}
	});
	const movement = readCityMovement(site, layout, columns, 0, rail, heads);
	return { site, layout, columns, rail, heads, ...movement };
}
