import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
import { acceptanceScene, houseGroups, installationView } from '../sandbox';
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
