import { type Vec3, size } from '../../lib/core/geometry';
import { PlaceableObject, bounds, type Shape } from '../../lib/core/object';

/** Centers a metric object on its display plinth and fits a common maximum display extent. */
export function mountSpecimen(object: PlaceableObject, x: number, y: number, extent: number) {
	const limit = bounds(object);
	const scale = extent / Math.max(...size(limit));
	const pivot: Vec3 = [
		(limit.min[0] + limit.max[0]) / 2,
		(limit.min[1] + limit.max[1]) / 2,
		limit.min[2]
	];
	const at = (px: number, py: number, pz: number): Vec3 => [
		x + (px - pivot[0]) * scale,
		y + (py - pivot[1]) * scale,
		(pz - pivot[2]) * scale
	];
	return PlaceableObject.create({
		...object,
		parts: object.parts.map((part) => ({ ...part, shape: fitShape(part.shape, at, scale) })),
		footprint: { width: object.footprint.width * scale, depth: object.footprint.depth * scale },
		anchors: object.anchors.map((anchor) => ({ ...anchor, position: at(...anchor.position) }))
	});
}

function fitShape(
	shape: Shape,
	at: (x: number, y: number, z: number) => Vec3,
	scale: number
): Shape {
	switch (shape.kind) {
		case 'box':
			return {
				...shape,
				center: at(...shape.center),
				size: [shape.size[0] * scale, shape.size[1] * scale, shape.size[2] * scale]
			};
		case 'prism':
			return {
				...shape,
				polygon: shape.polygon.map(([x, y]) => {
					const [u, v] = at(x, y, 0);
					return [u, v];
				}),
				base: at(0, 0, shape.base)[2],
				top: at(0, 0, shape.top)[2]
			};
		case 'mesh': {
			const positions: number[] = [];
			for (let i = 0; i < shape.positions.length; i += 3)
				positions.push(...at(shape.positions[i], shape.positions[i + 1], shape.positions[i + 2]));
			return { ...shape, positions };
		}
	}
}
