import type { Vec2 } from '../../core/geometry';
import { bounds, PlaceableObject, type Footprint } from '../../core/object';
import type { CityColumn, CityLattice } from '../../domain/city-volume';
import { districtSurfaces, planningStudy, resolveSurfaces } from '../surface';
import { envelopeMeshes } from './envelope';
import { latticeMesh } from './lattice';

type Frame = Readonly<{ footprint: Footprint; toLocal: (x: number, y: number) => Vec2 }>;
const slots = ['detached', 'block', 'center'] as const;

/** Projects the city's outer roof and exposed steps, with one surface per district kind.
 * The envelope follows the common level planes in true world meters. */
export function projectCityDistricts(columns: readonly CityColumn[], datumZ: number, frame: Frame) {
	const { patches, outlines } = envelopeMeshes(columns, datumZ, frame.toLocal);
	const object = PlaceableObject.create({
		id: 'districts',
		slots,
		parts: slots
			.filter((slot) => patches[slot].indices.length)
			.map((slot) => ({ id: slot, slot, shape: patches[slot] })),
		footprint: frame.footprint,
		anchors: []
	});
	const drawables = resolveSurfaces(object, districtSurfaces).map((part) => ({
		...part,
		strokeSegments: [...outlines[part.id as keyof typeof outlines].values()].flat()
	}));
	return { object, drawables, focus: bounds(object) };
}

/** Projects only the lattice's members and joints into the local terrain frame. */
export function projectCityLattice(lattice: CityLattice, frame: Frame) {
	const { geometry, wires } = latticeMesh(lattice, frame.toLocal);
	const object = PlaceableObject.create({
		id: 'lattice',
		slots: ['lattice'],
		parts: geometry.indices.length ? [{ id: 'lattice', slot: 'lattice', shape: geometry }] : [],
		footprint: frame.footprint,
		anchors: []
	});
	return {
		object,
		drawables: resolveSurfaces(object, planningStudy).map((part) => ({
			...part,
			strokeSegments: wires
		}))
	};
}
