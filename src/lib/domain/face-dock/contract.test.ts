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
const eps = 1e-8;
const spec = { id: 'room', widthM: 0.5, heightM: 0.5, depthM: 2 };

function socketFor(variant: LatticeVariant, slanted: boolean) {
	const sockets = readLatticeFaceSockets(createCityLattice([column], 0, variant));
	const socket = sockets.find(({ normal: [, , z] }) =>
		slanted ? Math.abs(z) > 0 && Math.abs(z) < 1 : z === 0
	);
	if (!socket) throw new Error(`Missing attachment face for ${variant}`);
	return socket;
}

function points(shape: Shape): Vec3[] {
	if (shape.kind !== 'mesh') throw new Error('Placed parts must use mesh geometry');
	const out: Vec3[] = [];
	for (let i = 0; i < shape.positions.length; i += 3)
		out.push([shape.positions[i], shape.positions[i + 1], shape.positions[i + 2]]);
	return out;
}

const height = ({ polygon, normal }: FaceSocket, p: Vec3) =>
	dotProduct(displacement(polygon[0], p), normal);

for (const variant of ['box', 'antiprism', 'diagrid', 'tree'] as const) {
	test(`${variant} yields a right-handed socket and flush collar-seated module`, () => {
		const socket = socketFor(variant, variant !== 'box');
		const { tangent, bitangent, normal } = socket;
		for (const axis of [tangent, bitangent, normal]) expect(length(axis)).toBeCloseTo(1, 12);
		expect(dotProduct(tangent, bitangent)).toBeCloseTo(0, 12);
		expect(dotProduct(tangent, normal)).toBeCloseTo(0, 12);
		expect(dotProduct(bitangent, normal)).toBeCloseTo(0, 12);
		crossProduct(tangent, bitangent).forEach((v, i) => expect(v).toBeCloseTo(normal[i], 12));
		for (const v of socket.polygon) expect(Math.abs(height(socket, v))).toBeLessThan(eps);

		const placed = createDockedModule(socket, spec);
		if (placed.status !== 'docked') throw new Error(placed.reason);
		const collarH = points(placed.object.parts[1].shape).map((v) => height(socket, v));
		const bodyH = points(placed.object.parts[0].shape).map((v) => height(socket, v));
		const collarTop = Math.max(...collarH);
		expect(Math.min(...collarH)).toBeCloseTo(0, 10);
		expect(collarTop).toBeGreaterThan(0);
		expect(Math.min(...bodyH)).toBeCloseTo(collarTop, 10);
		expect(Math.max(...bodyH)).toBeCloseTo(collarTop + spec.depthM, 10);
		expect(placed.object.anchors[0].position).toEqual(socket.center);
		expect(dotProduct(placed.object.anchors[0].normal, normal)).toBeCloseTo(-1, 12);
	});
}

test('shared faces are omitted and cyclic joint order preserves sockets', () => {
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
	const lattice = createCityLattice(
		[{ ...column, neighbors: [null, 'east', null, null] }, east],
		0
	);
	const sockets = readLatticeFaceSockets(lattice);
	expect(sockets).toHaveLength(28);
	expect(sockets.filter(({ polygon }) => polygon.every(([x]) => x === 8))).toHaveLength(0);
	const rotated = {
		...lattice,
		solids: lattice.solids.map((s) => ({
			...s,
			faces: s.faces.map((f) => [...f.slice(1), f[0]])
		}))
	};
	expect(readLatticeFaceSockets(rotated)).toEqual(sockets);
});

test('collar seats flush with zero volume overlap, stays exposed at full face, and carries no color', () => {
	const face = createFaceSocket({
		id: 'full',
		polygon: [
			[0, 0, 0],
			[4, 0, 0],
			[4, 4, 0],
			[0, 4, 0]
		]
	});
	const full = createDockedModule(face, { id: 'cover', widthM: 4, heightM: 4, depthM: 2 });
	if (full.status !== 'docked') throw new Error(full.reason);
	expect(createDockedModule(face, { id: 'cover', widthM: 4, heightM: 4, depthM: 2 })).toEqual(full);
	const [body, joint] = full.object.parts;
	const collarPts = points(joint.shape);
	const bodyPts = points(body.shape);
	const collarMaxZ = Math.max(...collarPts.map((p) => height(face, p)));
	expect(Math.min(...bodyPts.map((p) => height(face, p)))).toBeCloseTo(collarMaxZ, 10);
	expect(collarPts.slice(0, 4).every((p) => Math.abs(height(face, p)) < eps)).toBe(true);
	expect(collarPts.slice(0, 4).every(([x, y]) => x > 0 && x < 4 && y > 0 && y < 4)).toBe(true);
	expect(JSON.stringify(full.object)).not.toMatch(/--|#[a-f\d]{3,8}\b|\b(?:rgb|hsl)\(/i);
	expect(example().placement.status).toBe('docked');
});

test('rejects real overlaps, permits touching bounds and diagonally separated faces', () => {
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
	for (const socket of [floor, wall])
		expect(createDockedModule(socket, spec, { occupiedBounds: [fitted.bounds] })).toEqual({
			status: 'rejected',
			reason: 'occupied-overlap',
			occupiedIndex: 0
		});
	const { min, max } = fitted.bounds;
	expect(
		createDockedModule(floor, spec, {
			occupiedBounds: [{ min: [max[0], min[1], min[2]], max: [max[0] + 1, max[1], max[2]] }]
		}).status
	).toBe('docked');

	const diagA = createFaceSocket({
		id: 'diag-a',
		polygon: [
			[0, 0, 0],
			[2, 2, 0],
			[2, 2, 2],
			[0, 0, 2]
		]
	});
	const diagB = createFaceSocket({
		id: 'diag-b',
		polygon: [
			[2, 2, 0],
			[4, 4, 0],
			[4, 4, 2],
			[2, 2, 2]
		]
	});
	const first = createDockedModule(diagA, { id: 'm1', widthM: 1, heightM: 1, depthM: 3 });
	if (first.status !== 'docked') throw new Error(first.reason);
	const second = createDockedModule(
		diagB,
		{ id: 'm2', widthM: 1, heightM: 1, depthM: 3 },
		{ occupiedBounds: [first.bounds] }
	);
	expect(second.status).toBe('docked');
});

test('distinguishes mount/socket rejections, transforms off-center anchors, and validates inputs', () => {
	const socket = socketFor('antiprism', true);
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
	for (const z of [0, 2])
		expect(fitDockedModule(socket, moduleAt(z))).toEqual({
			status: 'rejected',
			reason: 'invalid-mount'
		});
	expect(createDockedModule(socket, { ...spec, widthM: 20 })).toEqual({
		status: 'rejected',
		reason: 'outside-socket'
	});

	const handle: PlaceableObject = {
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
	const placed = fitDockedModule(socket, handle);
	if (placed.status !== 'docked') throw new Error(placed.reason);
	expect(placed.object.parts.map(({ id }) => id)).toEqual(['frame', 'handle', 'dock-collar']);
	placed.object.anchors[0].normal.forEach((v, i) => expect(v).toBeCloseTo(socket.tangent[i], 12));
	expect(points(placed.object.parts[1].shape)[1]).toEqual(placed.object.anchors[0].position);

	expect(() =>
		createFaceSocket({
			id: '',
			polygon: [
				[0, 0, 0],
				[1, 0, 0],
				[0, 1, 0]
			]
		})
	).toThrow(RangeError);
	expect(() =>
		createFaceSocket({
			id: 'w',
			polygon: [
				[0, 0, 0],
				[2, 0, 0],
				[2, 2, 0],
				[0, 2, 1]
			]
		})
	).toThrow(RangeError);
	expect(() =>
		createFaceSocket({
			id: 'c',
			polygon: [
				[0, 0, 0],
				[2, 0, 0],
				[1, 0.5, 0],
				[2, 2, 0],
				[0, 2, 0]
			]
		})
	).toThrow(RangeError);
	expect(() => createDockedModule(socket, { ...spec, depthM: 0 })).toThrow(RangeError);
	expect(() =>
		fitDockedModule(socket, {
			...handle,
			slots: ['dock-collar'],
			parts: [{ ...handle.parts[0], id: 'dock-collar', slot: 'dock-collar' }]
		})
	).toThrow(RangeError);
	expect(() => fitDockedModule(socket, handle, [{ min: [2, 0, 0], max: [1, 1, 1] }])).toThrow(
		RangeError
	);
	expect(() =>
		readLatticeFaceSockets({
			...createCityLattice([column], 0),
			solids: [{ id: 'bad', bay: 'carrier', faces: [['missing-a', 'missing-b', 'missing-c']] }]
		})
	).toThrow(RangeError);
});
