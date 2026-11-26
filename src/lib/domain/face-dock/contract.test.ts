import { expect, test } from 'bun:test';
import { crossProduct, displacement, dotProduct, length, type Vec3 } from '../../core/geometry';
import type { PlaceableObject, Shape } from '../../core/object';
import { createCityLattice, type LatticeVariant } from '../city-volume';
import { example } from './example';
import {
	createDockedModule,
	createFaceSocket,
	fitDockedModule,
	readLatticeFaceSockets,
	type FaceSocket
} from './index';

const plan: readonly Vec3[] = [
	[0, 0, 0],
	[8, 0, 0],
	[8, 6, 0],
	[0, 6, 0]
];
const corners = plan.map((position, index) => ({ id: String(index), position }));
const column = { planCellId: 'carrier', corners, neighbors: plan.map(() => null), levels: 4 };
const epsilonM = 1e-8;
const spec = { id: 'room', widthM: 0.5, heightM: 0.5, depthM: 2 };

function socketFor(variant: LatticeVariant, slanted: boolean) {
	const lattice = createCityLattice([column], 0, variant);
	const sockets = readLatticeFaceSockets(lattice);
	const socket = sockets.find(({ normal: [, , z] }) =>
		slanted ? Math.abs(z) > 0 && Math.abs(z) < 1 : z === 0
	);
	if (!socket) throw new Error(`Missing attachment face for ${variant}`);
	return socket;
}

function points(shape: Shape): Vec3[] {
	if (shape.kind !== 'mesh') throw new Error('Placed parts must use mesh geometry');
	const vertices: Vec3[] = [];
	for (let i = 0; i < shape.positions.length; i += 3) {
		const [x, y, z] = shape.positions.slice(i, i + 3);
		vertices.push([x, y, z]);
	}
	return vertices;
}

const height = ({ polygon, normal }: FaceSocket, p: Vec3) =>
	dotProduct(displacement(polygon[0], p), normal);

for (const variant of ['box', 'antiprism', 'diagrid', 'tree'] as const) {
	test(`${variant} yields a right-handed socket and a flush outward module`, () => {
		const socket = socketFor(variant, variant !== 'box');
		const { tangent, bitangent, normal } = socket;
		for (const axis of [tangent, bitangent, normal]) expect(length(axis)).toBeCloseTo(1, 12);
		expect(dotProduct(tangent, bitangent)).toBeCloseTo(0, 12);
		expect(dotProduct(tangent, normal)).toBeCloseTo(0, 12);
		expect(dotProduct(bitangent, normal)).toBeCloseTo(0, 12);
		crossProduct(tangent, bitangent).forEach((value, axis) =>
			expect(value).toBeCloseTo(normal[axis], 12)
		);
		for (const vertex of socket.polygon)
			expect(Math.abs(height(socket, vertex))).toBeLessThan(epsilonM);

		const placed = createDockedModule(socket, spec);
		if (placed.status !== 'docked') throw new Error(placed.reason);
		const vertices = points(placed.object.parts[0].shape);
		const heights = vertices.map((vertex) => height(socket, vertex));
		expect(heights.filter((z) => Math.abs(z) < epsilonM)).toHaveLength(5);
		expect(heights.filter((z) => Math.abs(z - spec.depthM) < epsilonM)).toHaveLength(5);
		const [anchor] = placed.object.anchors;
		expect(anchor.position).toEqual(socket.center);
		expect(dotProduct(anchor.normal, normal)).toBeCloseTo(-1, 12);
	});
}

test('shared lattice faces are omitted and cyclic joint order does not change the sockets', () => {
	const east = {
		...column,
		planCellId: 'east',
		corners: [
			corners[1],
			{ id: 'e1', position: [16, 0, 0] as const },
			{ id: 'e2', position: [16, 6, 0] as const },
			corners[2]
		],
		neighbors: [null, null, null, column.planCellId]
	};
	const west = { ...column, neighbors: [null, east.planCellId, null, null] };
	const lattice = createCityLattice([west, east], 0);
	const sockets = readLatticeFaceSockets(lattice);
	expect(sockets).toHaveLength(28);
	expect(sockets.filter(({ polygon }) => polygon.every(([x]) => x === 8))).toHaveLength(0);
	expect(
		readLatticeFaceSockets({
			...lattice,
			solids: lattice.solids.map((solid) => ({
				...solid,
				faces: solid.faces.map((face) => [...face.slice(1), face[0]])
			}))
		})
	).toEqual(sockets);
});

test('collars derive from socket geometry without color data and replay deterministically', () => {
	const socket = socketFor('diagrid', true);
	const placed = createDockedModule(socket, spec);
	expect(createDockedModule(socket, spec)).toEqual(placed);
	if (placed.status !== 'docked') throw new Error(placed.reason);
	const joint = placed.object.parts.find(({ slot }) => slot === 'dock-collar');
	if (!joint) throw new Error('Expected a collar');
	const contact = points(joint.shape).slice(0, socket.polygon.length);
	expect(contact).toHaveLength(socket.polygon.length);
	for (const [i, point] of contact.entries()) {
		const rim = displacement(socket.center, socket.polygon[i]);
		const inset = displacement(socket.center, point);
		expect(length(crossProduct(rim, inset))).toBeLessThan(epsilonM);
		expect(dotProduct(rim, inset)).toBeGreaterThan(0);
		expect(length(inset)).toBeLessThan(length(rim));
		expect(Math.abs(height(socket, point))).toBeLessThan(epsilonM);
	}
	expect(
		points(joint.shape)
			.slice(contact.length, contact.length + socket.polygon.length)
			.every((vertex) => height(socket, vertex) > 0)
	).toBe(true);
	expect(JSON.stringify(placed.object)).not.toMatch(/--|#[a-f\d]{3,8}\b|\b(?:rgb|hsl)\(/i);
	expect(example().placement.status).toBe('docked');
});

test('rejects overlap at the same socket and at a neighboring face, permits touching bounds', () => {
	const floor = createFaceSocket({
		id: 'floor',
		polygon: [
			[0, 0, 0],
			[4, 0, 0],
			[4, 4, 0],
			[0, 4, 0]
		]
	});
	const wall = createFaceSocket({
		id: 'wall',
		polygon: [
			[0, 0, 0],
			[0, 4, 0],
			[0, 4, 4],
			[0, 0, 4]
		]
	});
	const fitted = createDockedModule(floor, spec);
	if (fitted.status !== 'docked') throw new Error(fitted.reason);
	const occupiedBounds = [fitted.bounds];
	for (const socket of [floor, wall]) {
		expect(createDockedModule(socket, spec, { occupiedBounds })).toEqual({
			status: 'rejected',
			reason: 'occupied-overlap',
			occupiedIndex: 0
		});
	}
	const { min, max } = fitted.bounds;
	expect(
		createDockedModule(floor, spec, {
			occupiedBounds: [{ min: [max[0], min[1], min[2]], max: [max[0] + 1, max[1], max[2]] }]
		}).status
	).toBe('docked');
});

test('distinguishes a floating or penetrating mount from one too large for the socket', () => {
	const socket = socketFor('box', false);
	const moduleAt = (z: number): PlaceableObject => ({
		id: 'room',
		slots: ['body'],
		footprint: { width: 1, depth: 1 },
		anchors: [],
		parts: [
			{
				id: 'body',
				slot: 'body',
				shape: { kind: 'box', center: [0, 0, z], size: [1, 1, 2], rotation: 0 }
			}
		]
	});
	for (const z of [0, 2]) {
		expect(fitDockedModule(socket, moduleAt(z))).toEqual({
			status: 'rejected',
			reason: 'invalid-mount'
		});
	}
	expect(createDockedModule(socket, { ...spec, widthM: 20 })).toEqual({
		status: 'rejected',
		reason: 'outside-socket'
	});
});

test('keeps part order and transforms off-center anchors with the same rigid frame', () => {
	const socket = socketFor('antiprism', true);
	const module: PlaceableObject = {
		id: 'room',
		slots: ['frame', 'hardware'],
		footprint: { width: 0.5, depth: 0.5 },
		parts: [
			{
				id: 'frame',
				slot: 'frame',
				shape: {
					kind: 'prism',
					polygon: [
						[-0.25, -0.25],
						[0.25, -0.25],
						[0, 0.25]
					],
					base: 0,
					top: 1
				}
			},
			{
				id: 'handle',
				slot: 'hardware',
				shape: { kind: 'mesh', positions: [0, 0, 1, 0.25, 0, 1, 0, 0, 1.25], indices: [0, 1, 2] }
			}
		],
		anchors: [{ name: 'handle', position: [0.25, 0, 1], normal: [1, 0, 0] }]
	};
	const placement = fitDockedModule(socket, module);
	if (placement.status !== 'docked') throw new Error(placement.reason);
	const { parts, anchors, footprint } = placement.object;
	expect(parts.map(({ id }) => id)).toEqual(['frame', 'handle', 'dock-collar']);
	expect(footprint).toEqual(module.footprint);
	anchors[0].normal.forEach((value, axis) => expect(value).toBeCloseTo(socket.tangent[axis], 12));
	expect(points(parts[1].shape)[1]).toEqual(anchors[0].position);
	expect(module.parts[0].shape.kind).toBe('prism');
});
