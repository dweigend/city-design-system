import { CatmullRomCurve3, Vector3 } from 'three/webgpu';
import type { Primitive, Vec3 } from '../parametrik/types';
import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
import { acceptanceScene, createWorld, houseGroups, installationView } from '../sandbox';
import { lineParts } from '../transit-line';
import { contactToleranceM, subtract } from './contact-surfaces';
import { deriveStructuralJoints, sandboxStructuralContacts } from './index';

function acceptanceJoints(reverse = false) {
	const { world, additions, earliestFullYear } = acceptanceScene(7);
	const { grid, state } = world;
	const houses = [...grid.chunks.keys()].flatMap((chunk) =>
		[...houseGroups(world, chunk, focuses.all, undefined, earliestFullYear)].map(
			([key, parts]) => ({
				key: 'house:' + key,
				parts
			})
		)
	);
	const batches = [
		...houses,
		{ key: 'study', parts: additions },
		{ key: 'installation', parts: installationView(world, 'all') },
		...world.lines.map((line) => ({ key: 'line:' + line.id, parts: lineParts(line) }))
	];
	const input = reverse
		? batches.toReversed().map(({ key, parts }) => ({ key, parts: parts.toReversed() }))
		: batches;
	const contacts = sandboxStructuralContacts(input, grid, state.year);
	const parts = new Map(
		batches.flatMap(({ key, parts }) => parts.map((part) => [key + '/' + part.id, part] as const))
	);
	return { contacts, parts, joints: deriveStructuralJoints(contacts) };
}

test('the seed-7 acceptance scene produces the same fittings on replay', () => {
	const { contacts, joints } = acceptanceJoints();
	expect(joints.length).toBeGreaterThan(0);
	expect(joints.length).toBe(contacts.length);
	const seats = new Set(contacts.map((contact) => contact.seat));
	expect(seats.has('terrain')).toBe(true);
	expect(seats.has('rail-saddle')).toBe(true);
	expect(seats.has('wall-crest')).toBe(true);
	expect(acceptanceJoints().contacts).toEqual(contacts);
});

test('acceptance slab collars sit on slab planes and post axes without moving endpoint joints', () => {
	const { contacts, parts, joints } = acceptanceJoints();
	const seams = contacts.filter(({ seat }) => seat === 'slab-seam');
	expect(seams).toHaveLength(19);
	const endpointContacts = contacts.filter(({ seat }) => seat !== 'slab-seam');
	expect(acceptanceJoints(true).joints).toEqual(joints);
	for (const { member, support, point, axis } of seams) {
		expect(
			endpointContacts.some(
				(endpoint) =>
					[endpoint.member.id, endpoint.support.id].includes(member.id) &&
					Math.hypot(...subtract(endpoint.point, point)) <= contactToleranceM
			)
		).toBe(false);
		const post = parts.get(member.id);
		const slab = parts.get(support.id);
		if (post?.kind !== 'cylinder' || slab?.kind !== 'prism') throw new Error('Expected post and slab');
		expect(Math.hypot(point[0] - post.position[0], point[1] - post.position[1])).toBeLessThan(1e-5);
		expect(Math.abs(point[2] - (slab.z + (axis[2] > 0 ? slab.height : 0)))).toBeLessThan(1e-5);
		expect(point[2]).toBeGreaterThan(post.position[2]);
		expect(point[2]).toBeLessThan(post.position[2] + post.height);
	}
	const endpoints = deriveStructuralJoints(endpointContacts);
	expect(endpoints).toHaveLength(733);
	// Digest of the seed-7 endpoint joint IDs and positions before surveying slab seams.
	expect(Bun.hash(JSON.stringify(endpoints.map(({ partId, point }) => [partId, point])))).toBe(
		1069928674048976998n
	);
});

function postAt(position: Vec3, height: number): Primitive {
	return {
		id: 'post',
		kind: 'cylinder',
		role: 'traeger',
		token: '--paper',
		material: 'metal',
		position,
		height,
		radius: 0.1
	};
}

function slabAt([x, y, z]: Vec3): Extract<Primitive, { kind: 'prism' }> {
	return {
		id: 'plate',
		kind: 'prism',
		bearing: 'slab',
		role: 'neu',
		token: '--paper',
		material: 'concrete',
		polygon: [[x - 1, y - 1], [x + 1, y - 1], [x + 1, y + 1], [x - 1, y + 1]],
		z,
		height: 0.25
	};
}

test('a flush slab face shares the terrain shoe on a post embedded below grade', () => {
	const { grid } = createWorld(7);
	const cell = grid.cellsById.get('89/36');
	if (!cell) throw new Error('Expected terrain cell');
	const [x, y, z] = cell.center;
	const post = postAt([x, y, z - 5], 10);
	const batches = (parts: Primitive[]) => [{ key: 'study', parts }];
	const [ground] = sandboxStructuralContacts(batches([post]), grid, 2027);
	expect(ground.seat).toBe('terrain');
	const slab = slabAt(ground.point);
	const contacts = sandboxStructuralContacts(batches([post, slab]), grid, 2027);
	expect(contacts.map(({ seat }) => seat).sort()).toEqual(['slab-seam', 'terrain']);
	expect(contacts.find(({ seat }) => seat === 'slab-seam')?.point[2]).toBe(slab.z + slab.height);
});

test('the underside receives a collar when the nearby post end faces away from it', () => {
	const { grid } = createWorld(7);
	const slab = slabAt([0, 0, 100]);
	const post = postAt([0, 0, slab.z - 5e-6], 1);
	const contacts = sandboxStructuralContacts([{ key: 'study', parts: [post, slab] }], grid, 2027);
	expect(contacts.map(({ seat, point }) => [seat, point])).toContainEqual([
		'slab-seam',
		[0, 0, slab.z]
	]);
});

test('a wall overprint prism supplies no through-post collars', () => {
	const { grid } = createWorld(7);
	const band = { ...slabAt([0, 0, 100]), id: 'body:wall:overprint:lap', overprint: '--ink' } as const;
	const post = postAt([0, 0, 99], 2);
	const contacts = sandboxStructuralContacts([{ key: 'study', parts: [post, band] }], grid, 2027);
	expect(contacts.filter(({ seat }) => seat === 'slab-seam')).toEqual([]);
});

test('a rail saddle follows the curved deck between control points', () => {
	const points: Vec3[] = [
		[0, 0, 10],
		[4, 0, 10],
		[4, 4, 10]
	];
	const rendered = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
	const { x, y, z } = rendered.getPoint(0.25);
	const batches: { key: string; parts: Primitive[] }[] = [
		{
			key: 'line:curve',
			parts: [
				{
					id: 'curve/deck',
					role: 'neu',
					token: '--paper',
					material: 'metal',
					kind: 'pipe',
					points,
					radius: 0.1
				}
			]
		},
		{
			key: 'support',
			parts: [
				{
					id: 'post',
					role: 'neu',
					token: '--paper',
					material: 'metal',
					kind: 'cylinder',
					member: 'primary',
					position: [x, y, z - 1],
					height: 1,
					radius: 0.04
				}
			]
		}
	];
	const seats = sandboxStructuralContacts(batches, createWorld(7).grid, 2027);
	const saddle = seats.find(({ seat }) => seat === 'rail-saddle');
	expect(saddle?.point[2]).toBeCloseTo(z - 0.1, 5);
});
