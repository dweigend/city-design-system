import { measurePolygon } from '../src/lib/core/geometry';
import { required } from '../src/lib/core/invariant';
import type { CityColumn } from '../src/lib/domain/city-volume';
import type { TerrainGrid } from '../src/lib/domain/terrain-grid';
import { surveyDefaults } from '../src/lib/domain/valley';
import { projectCityTerrain } from '../src/lib/scene/city-volume-projection';
import type { CitySite } from '../src/lib/world/city-site';
import { key } from './city-study-plan';

/** Compare foundation elevations against the ground and check ground at the corners and centroid. */
export function groundMetrics(city: CitySite, columns: readonly CityColumn[]) {
	let wetProbes = 0;
	let steepProbes = 0;
	let maxFoundationErrorM = 0;
	function probe(x: number, y: number) {
		const reading = city.valley.readGround(x, y);
		wetProbes += +(reading.cover !== 'dry');
		steepProbes += +(reading.slope > surveyDefaults.buildableSlope);
		return reading.height;
	}
	for (const { corners } of columns) {
		const points = corners.map(({ position }) => position);
		for (const [x, y, z] of points) {
			maxFoundationErrorM = Math.max(maxFoundationErrorM, Math.abs(z - probe(x, y)));
		}
		probe(...required(measurePolygon(points).centroid, 'column centroid'));
	}
	return { wetProbes, steepProbes, maxFoundationErrorM };
}

/** Validates that rendered ground contains every exact foundation sampled for a plan. */
export function groundContactMetrics(city: CitySite, grid: TerrainGrid) {
	const anchors = grid.vertices.map(({ position }) => position);
	const projection = projectCityTerrain(city, grid);
	const mesh = projection.drawables.find(({ finish }) => finish === 'terrain')?.shape;
	if (mesh?.kind !== 'mesh') throw new Error('Expected projected ground mesh');
	const positions = new Set<string>();
	for (let i = 0; i < mesh.positions.length; i += 3)
		positions.add(key(mesh.positions.slice(i, i + 3)));
	const missingRenderedFeet = anchors.filter(
		([x, y, z]) => !positions.has(key([...projection.toLocal(x, y), z]))
	).length;
	return { missingRenderedFeet };
}
