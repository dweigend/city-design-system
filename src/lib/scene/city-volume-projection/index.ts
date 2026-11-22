import type { Bounds3, Vec2 } from '../../core/geometry';
import { bounds, PlaceableObject, type Footprint } from '../../core/object';
import type { CityLattice, CityProfile } from '../../domain/city-volume';
import { planningStudy, resolveSurfaces } from '../surface';
import { latticeMesh } from './lattice';
import { profileMesh } from './profile';

type Frame = Readonly<{ footprint: Footprint; toLocal: (x: number, y: number) => Vec2 }>;

function project(
	id: 'profile' | 'lattice',
	frame: Frame,
	{ geometry, wires }: ReturnType<typeof latticeMesh>
) {
	const object = PlaceableObject.create({
		id,
		slots: [id],
		parts: geometry.indices.length ? [{ id, slot: id, shape: geometry }] : [],
		footprint: frame.footprint,
		anchors: []
	});
	return {
		object,
		drawables: resolveSurfaces(object, { [id]: planningStudy[id] }).map((drawable) => ({
			...drawable,
			strokeSegments: wires
		}))
	};
}

/** Samples a continuous profile over a CCW outline star-shaped about the summit.
 * Ground heights are unscaled world meters. Returns the surface, contour strokes and local bounds. */
export function projectCityProfile(
	profile: CityProfile,
	outline: readonly Vec2[],
	frame: Frame,
	groundHeight: (x: number, y: number) => number
) {
	const surface = project(
		'profile',
		frame,
		profileMesh(outline, profile, frame.toLocal, groundHeight)
	);
	const focus: Bounds3 = bounds(surface.object);
	return { ...surface, focus };
}

/** Projects only the lattice's members and joints into the local terrain frame. */
export function projectCityLattice(lattice: CityLattice, frame: Frame) {
	return project('lattice', frame, latticeMesh(lattice, frame.toLocal));
}
