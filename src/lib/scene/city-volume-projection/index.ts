import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { bounds, PlaceableObject, type Footprint } from '../../core/object';
import type { CityColumn, CityLattice } from '../../domain/city-volume';
import { districtSurfaces, planningStudy, resolveSurfaces } from '../surface';
import { envelopeMeshes } from './envelope';
import { latticeMesh } from './lattice';

type Frame = Readonly<{ footprint: Footprint; toLocal: (x: number, y: number) => Vec2 }>;
/** Maps the camera framing to continuous detail and height presentation. */
export { cityProfile } from './profile';
/** Styles the envelope and lattice as the camera moves. */
export { cityPresentation } from './presentation';

const slots = ['detached', 'block', 'center'] as const;

/** Projects the city's outer roof and exposed steps, with one surface per district kind.
 * An empty plan returns no drawables or focus. The envelope follows the common level planes in true world meters. */
export function projectCityDistricts(
	columns: readonly CityColumn[],
	datumZ: number,
	frame: Frame,
	byHeight = false
) {
	const patches = envelopeMeshes(columns, datumZ, frame.toLocal, byHeight);
	const object = PlaceableObject.create({
		id: 'districts',
		slots,
		parts: slots.flatMap((slot) =>
			[...patches]
				.filter(([, patch]) => patch.kind === slot)
				.map(([id, { shape }]) => ({ id, slot, shape }))
		),
		footprint: frame.footprint,
		anchors: []
	});
	const drawables = resolveSurfaces(object, districtSurfaces).map((part) => ({
		...part,
		levels: required(patches.get(part.id), 'envelope patch').levels,
		strokeSegments: [...required(patches.get(part.id), 'envelope patch').wires.values()].flat()
	}));
	function* points(): IterableIterator<Vec3> {
		for (const { shape } of object.parts) {
			if (shape.kind !== 'mesh') continue;
			const { positions } = shape;
			for (let i = 0; i < positions.length; i += 3)
				yield [positions[i], positions[i + 1], positions[i + 2]];
		}
	}
	return { object, drawables, focus: object.parts.length ? bounds(object) : undefined, points };
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
		drawables: resolveSurfaces(object, planningStudy).flatMap((part) => {
			if (part.shape.kind !== 'mesh') throw new Error('Expected lattice joints');
			const shape = {
				kind: 'mesh' as const,
				positions: part.shape.positions.slice(0, 9),
				indices: [0, 1, 2]
			};
			return [
				{ ...part, strokeSegments: wires.rims },
				{ ...part, id: 'uprights', shape, fillVisible: false, strokeSegments: wires.uprights },
				{ ...part, id: 'detail', shape, fillVisible: false, strokeSegments: wires.detail }
			];
		})
	};
}
