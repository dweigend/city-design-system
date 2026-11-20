import { clipPolygon, type Point2 } from '../../src/lib/catalog/logic/ansicht/geometrie';
import type { planHouse, sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { crossProduct, type Vec3 } from '../../src/lib/catalog/logic/parametrik/types';
import { houseStair } from '../../src/lib/catalog/data/house-stair';

const axes: Vec3[] = [
	[1, 0, 0],
	[0, 1, 0],
	[0, 0, 1]
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
function overlaps(points: Vec3[], half: Vec3, axis: Vec3) {
	const span = points.map((p) => dot(p, axis));
	const radius = dot(half, axis.map(Math.abs) as Vec3);
	return Math.min(...span) <= radius && Math.max(...span) >= -radius;
}

// The separating axes for a triangle or a segment against the walking box.
function intersects(points: Vec3[], half: Vec3) {
	if (!axes.every((axis) => overlaps(points, half, axis))) return false;
	const edges = points.map((p, i) => minus(points[(i + 1) % points.length], p));
	return (
		overlaps(points, half, crossProduct(edges[0], edges[1])) &&
		edges.every((e) => axes.every((axis) => overlaps(points, half, crossProduct(e, axis))))
	);
}

function footprintInside(ring: Point2[], center: Vec3, half: Vec3) {
	let poly = ring;
	for (const normal of [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	] as Point2[]) {
		const d =
			normal[0] * center[0] +
			normal[1] * center[1] +
			Math.abs(normal[0]) * half[0] +
			Math.abs(normal[1]) * half[1];
		poly = clipPolygon(poly, { normal, d });
	}
	return (
		Math.abs(
			poly.reduce((sum, p, i) => {
				const q = poly[(i + 1) % poly.length];
				return sum + p[0] * q[1] - p[1] * q[0];
			}, 0)
		) / 2
	);
}

/** Checks actual triangles and carrier segments against a person-wide walk from outside to the ladder. */
export function checkExteriorEntrance(
	house: ReturnType<typeof planHouse>,
	parts: ReturnType<typeof sectionParts>
) {
	const h = house.composition;
	const sign = h.accessSide === 'north' ? 1 : -1;
	const [x, y] = h.core.position;
	const end = Math.max(...h.cells.flatMap((c) => c.corners.map((p) => sign * p[1]))) + 0.1;
	const depth = end - sign * y;
	const floor = h.levels[0].landing[2];
	const center: Vec3 = [x, y + (sign * depth) / 2, floor + 1.05];
	const half: Vec3 = [houseStair.width / 2, depth / 2, 1.05 - 1e-7];
	for (const p of parts) {
		if (p.kind === 'prism' && p.id.startsWith(h.id + '/level/0/body/')) checkRoom(p, center, half);
		if (p.kind === 'mesh' && p.source.objectId === 'full-height-shell') checkMesh(p, center, half);
		if (p.kind === 'pipe' && p.id.startsWith(h.id + '/frame/')) checkCarrier(p, center, half);
	}
}

type Part = ReturnType<typeof sectionParts>[number];
function checkRoom(p: Extract<Part, { kind: 'prism' }>, center: Vec3, half: Vec3) {
	if (p.z >= center[2] + half[2] || p.z + p.height <= center[2] - half[2]) return;
	const occupied =
		footprintInside(p.polygon, center, half) -
		(p.holes ?? []).reduce((sum, hole) => sum + footprintInside(hole, center, half), 0);
	if (occupied > 1e-8) throw Error('Blocked entrance room: ' + p.id);
}
function checkMesh(p: Extract<Part, { kind: 'mesh' }>, center: Vec3, half: Vec3) {
	const points = p.points.map((v) => minus(v, center));
	for (let i = 0; i < p.triangles.length; i += 3) {
		const face = p.triangles.slice(i, i + 3).map((j) => points[j]);
		if (intersects(face, half)) throw Error('Blocked exterior entrance: ' + p.id);
	}
}
function checkCarrier(p: Extract<Part, { kind: 'pipe' }>, center: Vec3, half: Vec3) {
	const clearance = half.map((n) => n + p.radius - 1e-8) as Vec3;
	for (let i = 1; i < p.points.length; i++) {
		const segment = [p.points[i - 1], p.points[i]].map((v) => minus(v, center));
		if (intersects(segment, clearance)) throw Error('Blocked entrance frame: ' + p.id);
	}
}
