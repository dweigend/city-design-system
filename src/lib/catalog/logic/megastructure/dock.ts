import { STORY } from '../../data/grid';
import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../params';
import { rechteck, schneidet } from '../haus-tragwerk';
import type { Vec3 } from '../traeger';
type Direction = readonly [number, number, number];
export type Socket = { point: Direction; normal: Direction; tangent: Direction };
export type Bounds = { min: Vec3; max: Vec3 };
type Obstacle = Bounds | { a: Vec3; b: Vec3; radius: number };
function finitePoint(p: Direction) {
	return p.length === 3 && [p[0], p[1], p[2]].every(Number.isFinite);
}
function validateObstacle(b: Obstacle) {
	if ('min' in b) {
		if (!finitePoint(b.min) || !finitePoint(b.max) || b.min.some((v, i) => v > b.max[i]))
			throw new RangeError('Invalid obstacle bounds');
	} else if (!finitePoint(b.a) || !finitePoint(b.b) || !Number.isFinite(b.radius) || b.radius < 0)
		throw new RangeError('Invalid obstacle segment');
}
/** Tests two world-space docking bounds for penetration, allowing touching faces. */
export function dockBoundsOverlap(bounds: Bounds, b: Bounds) {
	return bounds.min.every((v, i) => v < b.max[i] - 1e-9 && bounds.max[i] > b.min[i] + 1e-9);
}
function intersects(bounds: Bounds, b: Obstacle) {
	if ('min' in b) return dockBoundsOverlap(bounds, b);
	const [x, y, z] = bounds.min,
		[X, Y, Z] = bounds.max,
		r = b.radius;
	return schneidet(b.a, b.b, {
		polygon: rechteck(x - r, y - r, X - x + 2 * r, Y - y + 2 * r),
		z: z - r,
		hoeheM: Z - z + 2 * r
	});
}
const sizes = {
	capsule: [4, 2, 2],
	tank: [2, 2, 2],
	ceramic: [3, 3, STORY],
	'solar-ring': [3, 3, 0.5],
	garden: [4, 3, 0.5]
} as const;
export type ModuleKind = keyof typeof sizes;
const dockParams = defineParams({
	pitch: numberParam('Module pitch', 'm', 1, [0.25, 4, 0.25])
});
function unit(p: Direction): Vec3 {
	const d = Math.hypot(...p);
	if (!Number.isFinite(d) || d < 1e-9) throw new RangeError('Invalid socket axis');
	return [p[0] / d, p[1] / d, p[2] / d];
}
function crossVector(a: Direction, b: Direction): Vec3 {
	const minor = (i: number, j: number) => a[i] * b[j] - a[j] * b[i];
	return [minor(1, 2), minor(2, 0), minor(0, 1)];
}
/** Places one module against a socket plane in meters. Normal points outwards.
 * Gram–Schmidt retains the supplied tangent direction in the plane. World AABBs
 * conservatively reject penetration; face contact is allowed. Returns detached data
 * or undefined when occupied. Invalid obstacles, degenerate axes and nonfinite points throw RangeError.
 */
export function dockModule(
	kind: ModuleKind,
	socket: Socket,
	occupied: readonly Obstacle[],
	overrides?: ParamOverrides<typeof dockParams>
) {
	occupied.forEach(validateObstacle);
	const { pitch } = resolveParams(dockParams, overrides);
	const normal = unit(socket.normal),
		side = unit(crossVector(normal, unit(socket.tangent))),
		tangent = crossVector(side, normal);
	if (!socket.point.every(Number.isFinite)) throw new RangeError('Invalid socket point');
	const [w, d, h] = sizes[kind],
		size: Vec3 = [w * pitch, d * pitch, h * pitch];
	const center: Vec3 = [...socket.point],
		bounds: Bounds = { min: [0, 0, 0], max: [0, 0, 0] };
	for (let i = 0; i < 3; i++) {
		center[i] += (normal[i] * size[2]) / 2;
		const extent =
			(Math.abs(tangent[i]) * size[0] +
				Math.abs(side[i]) * size[1] +
				Math.abs(normal[i]) * size[2]) /
			2;
		bounds.min[i] = center[i] - extent;
		bounds.max[i] = center[i] + extent;
	}
	if (occupied.some((b) => intersects(bounds, b))) return;
	return { kind, center, normal, tangent, side, size, bounds };
}
export type DockedModule = NonNullable<ReturnType<typeof dockModule>>;
