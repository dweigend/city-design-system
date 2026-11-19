import { CatmullRomCurve3, Vector3 } from 'three/webgpu';
import type { Primitive, Vec3 } from '../parametrik/types';
import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
import { acceptanceScene, createWorld, houseGroups, installationView } from '../sandbox';
import { lineParts } from '../transit-line';
import { deriveStructuralJoints, sandboxStructuralContacts } from './index';

function acceptanceJoints() {
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
	const contacts = sandboxStructuralContacts(batches, grid, state.year);
	return { contacts, joints: deriveStructuralJoints(contacts) };
}

test('the seed-7 acceptance scene produces the same fittings on replay', () => {
	const { contacts, joints } = acceptanceJoints();
	expect(joints.length).toBeGreaterThan(0);
	expect(joints.length).toBe(contacts.length);
	const seats = new Set(contacts.map((contact) => contact.seat));
	expect(seats.has('terrain')).toBe(true);
	expect(seats.has('rail-saddle')).toBe(true);
	expect(seats.has('wall-crest')).toBe(true);
	expect(acceptanceJoints().joints).toEqual(joints);
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
