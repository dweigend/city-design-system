import { ShapeUtils, Vector2 } from 'three/webgpu';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';

// Profile of a folded paper portal. The clipped corner and stepped shoulder are visible
// from opposite banks. The uninterrupted top edge still seats the next floor.
const edge = [
	[0, 0],
	[0.16, 0],
	[0.16, 0.58],
	[0.35, 0.82],
	[0.72, 0.82],
	[0.72, 0.56],
	[0.85, 0.56],
	[0.85, 0],
	[1, 0],
	[1, 1],
	[0, 1]
];
const n = edge.length;
const cap = ShapeUtils.triangulateShape(
	edge.map(([u, h]) => new Vector2(u, h)),
	[]
);
const triangles = [
	...cap.flatMap(([a, b, c]) => [a, b, c, n + c, n + b, n + a]),
	...edge.flatMap((_, i) => {
		const j = (i + 1) % n;
		return [i, n + i, n + j, i, n + j, j];
	})
];

/** Cuts a through-opening in the new collage's upper paper bay. Faces, ink and picking
 * share these triangles. Its original surveyed quadrilateral carries both cut faces. */
export function collageCut(part: Primitive): Primitive {
	if (
		part.kind !== 'prism' ||
		!part.envelope ||
		!part.glass ||
		part.role !== 'neu' ||
		part.material !== 'paper' ||
		part.polygon.length !== 4
	)
		return part;
	const [a, b, c, d] = part.polygon;
	const face = (left: number[], right: number[]) =>
		edge.map(([u, h]): Vec3 => [
			left[0] + u * (right[0] - left[0]),
			left[1] + u * (right[1] - left[1]),
			part.z + h * part.height
		]);
	const area = ShapeUtils.area(part.polygon.map(([x, y]) => new Vector2(x, y)));
	return {
		...part,
		rotation: undefined,
		kind: 'mesh',
		glass: false,
		edges: false,
		points: [...face(a, b), ...face(d, c)],
		triangles: area < 0 ? [...triangles].reverse() : triangles,
		lines: []
	};
}

/** Separates the cut faces from the folded returns so the host bay can carry its figure's pigment. */
export function printPortal(part: Extract<Primitive, { kind: 'mesh' }>, token: Primitive['token']) {
	const printed: number[] = [],
		clay: number[] = [];
	for (let i = 0; i < part.triangles.length; i += 3) {
		const tri = part.triangles.slice(i, i + 3);
		const face = tri.every((v) => v < n) || tri.every((v) => v >= n);
		(face ? printed : clay).push(...tri);
	}
	return {
		face: { ...part, token, envelope: false, triangles: printed },
		returns: { ...part, triangles: clay }
	};
}
