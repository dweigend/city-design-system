import { defaults } from '../../../config/face-dock';
import {
	isFiniteVector,
	scaled,
	sum,
	type Bounds3,
	type Vec2,
	type Vec3
} from '../../core/geometry';
import { bounds, PlaceableObject } from '../../core/object';
import { encodeKey } from '../../core/ref';
import { extrudeRing, localMesh, meshPoints } from './mesh';
import { socketRing, type FaceSocket } from './socket';

const collarSlot = 'dock-collar';
const { dockContactToleranceM: contactToleranceM } = defaults;

export type DockModuleSpec = Readonly<{
	id: string;
	widthM: number;
	heightM: number;
	depthM: number;
}>;

export type DockOptions = Readonly<{ occupiedBounds?: readonly Bounds3[] }>;

export type DockFit =
	| Readonly<{ status: 'docked'; object: PlaceableObject; bounds: Bounds3 }>
	| Readonly<{ status: 'rejected'; reason: 'invalid-mount' | 'outside-socket' }>
	| Readonly<{ status: 'rejected'; reason: 'occupied-overlap'; occupiedIndex: number }>;

function containsPoint(ring: readonly Vec2[], [x, y]: Vec3) {
	return ring.every(([ax, ay], index) => {
		const [bx, by] = ring[(index + 1) % ring.length];
		const dx = bx - ax;
		const dy = by - ay;
		return dx * (y - ay) - dy * (x - ax) >= -contactToleranceM * Math.hypot(dx, dy);
	});
}

function validateBounds(occupied: Bounds3) {
	const { min, max } = occupied;
	if (
		!isFiniteVector(min, 3) ||
		!isFiniteVector(max, 3) ||
		min.some((value, axis) => value > max[axis])
	)
		throw new RangeError('Expected finite ordered occupancy bounds');
}

function overlaps(a: Bounds3, b: Bounds3) {
	return a.min.every(
		(value, axis) =>
			Math.min(a.max[axis], b.max[axis]) - Math.max(value, b.min[axis]) > contactToleranceM
	);
}

// Exact arithmetic: an indexed triangle consists of three local vertex indices.
function hasMountingTriangle(points: readonly Vec3[], indices: readonly number[]) {
	for (let i = 0; i < indices.length; i += 3) {
		const [ax, ay, az] = points[indices[i]];
		const [bx, by, bz] = points[indices[i + 1]];
		const [cx, cy, cz] = points[indices[i + 2]];
		if (az === 0 && bz === 0 && cz === 0 && (bx - ax) * (cy - ay) !== (by - ay) * (cx - ax))
			return true;
	}
	return false;
}

function place(
	socket: FaceSocket,
	module: PlaceableObject,
	parts: readonly { id: string; slot: string; shape: ReturnType<typeof localMesh> }[]
) {
	const { tangent, bitangent, normal, center } = socket;
	const direction = ([x, y, z]: Vec3) =>
		sum(sum(scaled(tangent, x), scaled(bitangent, y)), scaled(normal, z));
	const point = (local: Vec3) => sum(center, direction(local));
	return PlaceableObject.create({
		id: encodeKey([socket.id, module.id]),
		footprint: module.footprint,
		slots: [...module.slots, collarSlot],
		parts: parts.map(({ id, slot, shape }) => ({
			id,
			slot,
			shape: { ...shape, positions: meshPoints(shape).flatMap(point) }
		})),
		anchors: module.anchors.map((anchor) => ({
			...anchor,
			position: point(anchor.position),
			normal: direction(anchor.normal)
		}))
	});
}

/** Fits a local module in meters with its mounting face at z = 0 and its body at positive z.
 * Parts become world-space meshes and anchors transform with the same rigid frame. The result
 * is detached, and the object is frozen. An AABB broad phase permits touching bounds, keeps
 * input order and reports the first overlap. Invalid object data or bounds throw RangeError.
 */
export function fitDockedModule(
	socket: FaceSocket,
	module: PlaceableObject,
	occupiedBounds: readonly Bounds3[] = []
): DockFit {
	occupiedBounds.forEach(validateBounds);
	const local = PlaceableObject.isValidated(module) ? module : PlaceableObject.create(module);
	if (local.slots.includes(collarSlot) || local.parts.some(({ id }) => id === collarSlot))
		throw new RangeError(`Reserved dock part and slot: ${collarSlot}`);
	const parts = local.parts.map((part) => ({ ...part, shape: localMesh(part.shape) }));
	const groups = parts.map(({ shape }) => meshPoints(shape));
	const points = groups.flat();
	const depth = points.reduce((max, [, , z]) => Math.max(max, z), 0);
	if (
		!depth ||
		points.some(([, , z]) => z < 0) ||
		!parts.some(({ shape }, index) => hasMountingTriangle(groups[index], shape.indices))
	)
		return { status: 'rejected', reason: 'invalid-mount' };

	const ring = socketRing(socket);
	if (points.some((point) => point[2] === 0 && !containsPoint(ring, point)))
		return { status: 'rejected', reason: 'outside-socket' };

	const collar = ring.map(([x, y]): Vec2 => [
		x * defaults.collarInsetRatio,
		y * defaults.collarInsetRatio
	]);
	// Exact arithmetic: reserve at least half the body's depth beyond the collar.
	const collarDepth = Math.min(
		defaults.collarDepthM,
		depth / /* Exact arithmetic: half the module depth. */ 2
	);
	const object = place(socket, local, [
		...parts,
		{
			id: collarSlot,
			slot: collarSlot,
			shape: extrudeRing(
				collar,
				/* Exact arithmetic: the collar starts in the contact plane. */ 0,
				collarDepth
			)
		}
	]);
	const extent = bounds(object);
	const occupiedIndex = occupiedBounds.findIndex((occupied) => overlaps(extent, occupied));
	if (occupiedIndex >= 0) return { status: 'rejected', reason: 'occupied-overlap', occupiedIndex };
	return { status: 'docked', object, bounds: extent };
}

/** Fits a rectangular module with positive dimensions in meters and an anchor at its mount.
 * Invalid dimensions throw RangeError. By default the occupied list is empty. The spec and
 * options remain untouched. The result has the same ownership and rejection rules as fit.
 */
// Exact arithmetic: a rectangular module is centered at half its outward thickness.
export function createDockedModule(
	socket: FaceSocket,
	{ id, widthM, heightM, depthM }: DockModuleSpec,
	{ occupiedBounds }: DockOptions = {}
): DockFit {
	if (!id || ![widthM, heightM, depthM].every((value) => Number.isFinite(value) && value > 0))
		throw new RangeError('Expected a keyed module with positive finite dimensions');
	return fitDockedModule(
		socket,
		{
			id,
			slots: ['body'],
			footprint: { width: widthM, depth: heightM },
			anchors: [
				{
					name: 'mount',
					position: /* Exact arithmetic: local origin. */ [0, 0, 0],
					normal: /* Exact arithmetic: mount normal points along negative Z. */ [0, 0, -1]
				}
			],
			parts: [
				{
					id: 'body',
					slot: 'body',
					shape: {
						kind: 'box',
						size: [widthM, heightM, depthM],
						center: /* Exact arithmetic: the box is centered on the local Z axis. */ [
							0,
							0,
							depthM / /* Exact arithmetic: half the box depth. */ 2
						],
						rotation: /* Exact arithmetic: the box is aligned with the local axes. */ 0
					}
				}
			]
		},
		occupiedBounds
	);
}
