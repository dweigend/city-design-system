import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { ParcelPlan } from '../../domain/parcels';
import type { TerrainGrid } from '../../domain/terrain-grid';
import {
	cityWindow,
	sampleCityWindow,
	type CityCrossing,
	type CitySite
} from '../../world/city-site';
import { landscape, type Drawable } from '../surface';
import { terrainGridProjection } from '../terrain-grid-projection';
import { projectValleyWindow } from '../valley-projection';
import { pinGround } from './ground-anchors';
import { projectParcelPlan } from './parcel-plan';
import { projectWetPlan } from './plan-water';

/** Projects the city window at true scale, welding the plan's sampled foundation corners
 * into the ground triangles. The terrain itself stays unchanged outside this projection. */
export function projectCityTerrain(city: CitySite, grid: TerrainGrid, plan = grid) {
	const window = cityWindow(city, plan);
	const { drawables, footprint, toLocal, autoHeightScale, traceTributaries } = city.valley
		? projectValleyWindow(city.valley, window, 1)
		: projectSampledWindow(city, window);
	const ground = required(
		drawables.find(({ finish }) => finish === 'terrain'),
		'terrain ground'
	);
	if (ground.shape.kind !== 'mesh') throw new Error('Expected a terrain mesh');
	const shape = pinGround(
		ground.shape,
		grid.vertices.map(({ position: [x, y, z] }): Vec3 => [...toLocal(x, y), z])
	);
	const traces = traceTributaries?.(shape);
	return {
		drawables: drawables.map((part) => {
			if (part === ground) return { ...part, shape };
			if (part.id === 'river' && traces) return { ...part, ...traces };
			return part;
		}),
		footprint,
		autoHeightScale,
		toLocal,
		projectPlan: terrainGridProjection(shape, toLocal, footprint),
		/** Projects the reserved plan geometry as layers that can be switched without new meshes. */
		projectParcels: (parcels: ParcelPlan) => projectParcelPlan(shape, toLocal, parcels),
		/** Projects the continuous plan, with separate strokes for wet edges and crossings. */
		projectWetPlan: (
			crossings: readonly CityCrossing[],
			mergedUnits: ParcelPlan['mergedUnits'] = []
		) => projectWetPlan(city, shape, toLocal, plan, crossings, mergedUnits)
	};
}

function projectSampledWindow(city: CitySite, window: ReturnType<typeof cityWindow>) {
	const { ground, water, toLocal, footprint } = sampleCityWindow(city.sampleGround, window);
	const drawables: Drawable[] = [{ id: 'ground', shape: ground, ...landscape.ground }];
	if (water.indices.length) drawables.push({ id: 'river', shape: water, ...landscape.water });
	return { drawables, footprint, toLocal, autoHeightScale: 1, traceTributaries: undefined };
}
