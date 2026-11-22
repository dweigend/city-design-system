import type { Vec2 } from '../../core/geometry';
import { PlaceableObject, type Footprint } from '../../core/object';
import type { CityVolume } from '../../domain/city-volume';
import type { TerrainGrid } from '../../domain/terrain-grid';
import { planningStudy, resolveSurfaces, type Drawable } from '../surface';
import { latticeMesh } from './lattice';
import { profileMesh } from './profile';

const noStrokes: readonly number[] = Object.freeze([]);

/** Projects the sampled profile and the full metric cells as separate drawable batches.
 * The XY transform puts both in the terrain's local frame. The ground sampler returns
 * unscaled world terrain heights in meters. No vertices or faces are added to an empty grid. */
export function projectCityVolume(
	volume: CityVolume,
	plan: TerrainGrid,
	footprint: Footprint,
	toLocal: (x: number, y: number) => Vec2,
	groundHeight: (x: number, y: number) => number
) {
	const profile = profileMesh(plan, volume.profile, toLocal, groundHeight);
	const lattice = latticeMesh(plan, volume.grid, toLocal);
	const parts = [
		{ id: 'lattice', slot: 'lattice', shape: lattice.geometry },
		{ id: 'profile', slot: 'profile', shape: profile.geometry },
		{ id: 'nodes', slot: 'nodes', shape: profile.nodes }
	];
	const object = PlaceableObject.create({
		id: 'city-volume',
		slots: parts.map(({ slot }) => slot),
		parts: parts.filter(({ shape }) => shape.indices.length),
		footprint,
		anchors: []
	});
	const drawables: Drawable[] = resolveSurfaces(object, planningStudy).map((drawable) => ({
		...drawable,
		strokeSegments:
			drawable.id === 'profile'
				? profile.wires
				: drawable.id === 'lattice'
					? lattice.wires
					: noStrokes
	}));
	return { object, drawables };
}
