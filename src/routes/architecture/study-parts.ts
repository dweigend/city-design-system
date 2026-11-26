import type { Vec3 } from '../../lib/core/geometry';
import { PlaceableObject, type Part, type Shape } from '../../lib/core/object';
import { resolveSurfaces, type Surface } from '../../lib/scene/surface';

type StudyBox = Part & { shape: Extract<Shape, { kind: 'box' }> };

export function box(id: string, center: Vec3, size: Vec3): StudyBox {
	return { id, slot: 'body', shape: { kind: 'box', center, size, rotation: 0 } };
}

export function studyStock(id: string, parts: readonly StudyBox[], finish: Surface) {
	const extent = (axis: 0 | 1) =>
		Math.max(...parts.map(({ shape }) => shape.center[axis] + shape.size[axis] / 2)) -
		Math.min(...parts.map(({ shape }) => shape.center[axis] - shape.size[axis] / 2));
	return resolveSurfaces(
		PlaceableObject.create({
			id,
			parts,
			slots: ['body'],
			anchors: [],
			footprint: { width: extent(0), depth: extent(1) }
		}),
		{ body: finish }
	);
}
