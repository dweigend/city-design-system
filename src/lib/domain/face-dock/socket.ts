import { defaults } from '../../../config/face-dock';
import {
	bounds,
	crossProduct,
	displacement,
	dotProduct,
	isConvexCounterclockwise,
	isFiniteVector,
	isSimpleRing,
	length,
	measurePolygon,
	scaled,
	sum,
	unitVector,
	type Vec2,
	type Vec3
} from '../../core/geometry';
import { encodeKey } from '../../core/ref';
import { latticeVolumes, type CityLattice } from '../city-volume';

export type DockFace = Readonly<{ id: string; polygon: readonly Vec3[] }>;

export type FaceSocket = Readonly<{
	id: string;
	center: Vec3;
	normal: Vec3;
	tangent: Vec3;
	bitangent: Vec3;
	widthM: number;
	heightM: number;
	polygon: readonly Vec3[];
}>;

const { dockContactToleranceM: contactToleranceM } = defaults;

function faceFrame(polygon: readonly Vec3[]) {
	const origin = polygon[0];
	let areaVector: Vec3 = /* Exact arithmetic: vector sum starts at the origin. */ [0, 0, 0];
	let longest = displacement(origin, polygon[1]);
	for (const [index, point] of polygon.entries()) {
		const next = polygon[(index + 1) % polygon.length];
		const edge = displacement(point, next);
		areaVector = sum(areaVector, crossProduct(displacement(origin, point), edge));
		if (length(edge) > length(longest)) longest = edge;
	}
	if (length(areaVector) <= contactToleranceM * length(longest)) return;
	const normal = unitVector(areaVector);
	const rawBitangent = crossProduct(normal, longest);
	if (length(rawBitangent) <= contactToleranceM * length(longest)) return;
	const bitangent = unitVector(rawBitangent);
	const tangent = crossProduct(bitangent, normal);
	return { normal, tangent, bitangent };
}

function project(point: Vec3, origin: Vec3, tangent: Vec3, bitangent: Vec3): Vec2 {
	const delta = displacement(origin, point);
	return [dotProduct(delta, tangent), dotProduct(delta, bitangent)];
}

export function socketRing(socket: FaceSocket): readonly Vec2[] {
	return socket.polygon.map((point) =>
		project(point, socket.center, socket.tangent, socket.bitangent)
	);
}

function planarSocket({ id, polygon }: DockFace): FaceSocket | undefined {
	// Exact arithmetic: three vertices are the minimum for a face.
	if (polygon.length < 3) return;
	const frame = faceFrame(polygon);
	if (!frame) return;
	const origin = polygon[0];
	const { normal, tangent, bitangent } = frame;
	if (
		polygon.some(
			(point) => Math.abs(dotProduct(displacement(origin, point), normal)) > contactToleranceM
		)
	)
		return;
	const ring = polygon.map((point) => project(point, origin, tangent, bitangent));
	if (!isSimpleRing(ring) || !isConvexCounterclockwise(ring)) return;
	const { centroid } = measurePolygon(ring);
	const extent = bounds(
		ring.map(([x, y]) => /* Exact arithmetic: socket-local points lie in the mounting plane. */ [
			x,
			y,
			0
		])
	);
	if (!centroid || !extent) return;
	const [u, v] = centroid;
	return Object.freeze({
		id,
		...frame,
		center: Object.freeze(sum(origin, sum(scaled(tangent, u), scaled(bitangent, v)))),
		normal: Object.freeze(normal),
		tangent: Object.freeze(tangent),
		bitangent: Object.freeze(bitangent),
		widthM: extent.max[0] - extent.min[0],
		heightM: extent.max[1] - extent.min[1],
		polygon: Object.freeze(polygon.map(([x, y, z]): Vec3 => Object.freeze([x, y, z])))
	});
}

/** Returns a detached, frozen socket in meters. Polygon order defines the outward normal
 * and breaks longest-edge ties. Invalid, warped, or non-convex input throws RangeError. */
export function createFaceSocket(face: DockFace): FaceSocket {
	const socket =
		face.id && Array.from(face.polygon).every((point) => isFiniteVector(point, 3))
			? planarSocket(face)
			: undefined;
	if (!socket) throw new RangeError('Expected a keyed convex planar dock face');
	return socket;
}

function canonicalLoop(loop: readonly string[]): readonly string[] {
	const start = loop.reduce((least, id, index) => (id < loop[least] ? index : least), 0);
	return [...loop.slice(start), ...loop.slice(0, start)];
}

/** Reads detached sockets ordered by first face incidence. Shared faces, warped or non-convex
 * faces and planes that do not support their owner solid are omitted. Invalid joint references
 * throw RangeError. IDs come from joint incidence and survive cyclic shifts of the face loop. */
export function readLatticeFaceSockets(lattice: CityLattice): readonly FaceSocket[] {
	const positions = new Map(lattice.nodes.map(({ id, position }) => [id, position]));
	const volumes = latticeVolumes(lattice);
	const readPoint = (id: string) => {
		const point = positions.get(id);
		if (!point) throw new RangeError(`Unknown lattice joint ${id}`);
		return point;
	};
	const faces = new Map<string, { loop: readonly string[]; owner: readonly Vec3[] } | undefined>();
	for (const [index, solid] of lattice.solids.entries()) {
		const owner = [...new Set(solid.faces.flat())].map(readPoint);
		for (const loop of solid.faces) {
			const id = encodeKey(loop.toSorted());
			faces.set(id, faces.has(id) || volumes[index] <= 0 ? undefined : { loop, owner });
		}
	}
	const sockets = [];
	for (const [id, face] of faces) {
		if (!face) continue;
		const socket = planarSocket({ id, polygon: canonicalLoop(face.loop).map(readPoint) });
		if (
			socket &&
			face.owner.every(
				(point) =>
					dotProduct(displacement(socket.center, point), socket.normal) <= contactToleranceM
			)
		)
			sockets.push(socket);
	}
	return Object.freeze(sockets);
}
