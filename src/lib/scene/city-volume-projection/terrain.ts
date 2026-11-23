import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { TerrainGrid } from '../../domain/terrain-grid';
import { cityWindow, type CitySite } from '../../world/city-site';
import { terrainGridProjection } from '../terrain-grid-projection';
import { projectValleyWindow } from '../valley-projection';
import { pinGround } from './ground-anchors';

/** Projects the city window at true scale, welding the plan's sampled foundation corners
 * into the ground triangles. The terrain itself stays unchanged outside this projection. */
export function projectCityTerrain(city: CitySite, grid: TerrainGrid) {
	const { drawables, footprint, toLocal, autoHeightScale, traceTributaries } = projectValleyWindow(
		city.valley,
		cityWindow(city, grid),
		1
	);
	const ground = required(
		drawables.find(({ finish }) => finish === 'terrain'),
		'terrain ground'
	);
	if (ground.shape.kind !== 'mesh') throw new Error('Expected a terrain mesh');
	const shape = pinGround(
		ground.shape,
		grid.vertices.map(({ position: [x, y, z] }): Vec3 => [...toLocal(x, y), z])
	);
	const traces = traceTributaries(shape);
	return {
		drawables: drawables.map((part) => {
			if (part === ground) return { ...part, shape };
			if (part.id === 'river' && traces) return { ...part, ...traces };
			return part;
		}),
		footprint,
		autoHeightScale,
		toLocal,
		projectPlan: terrainGridProjection(shape, toLocal, footprint)
	};
}
