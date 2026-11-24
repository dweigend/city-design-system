import { expect, test } from 'bun:test';
import { createMovementNetwork, type MovementLink, type MovementNode } from './index';
import { movementExample } from './example';

test('orders equal costs by settled node and stable link IDs', () => {
	const nodes: MovementNode[] = [
		{ id: 'start', position: [0, 0, 0], level: 'ground' },
		{ id: 'a', position: [3, 0, 4], level: 1 },
		{ id: 'b', position: [0, 3, 4], level: 1 },
		{ id: 'end', position: [3, 3, 0], level: 'ground' },
		{ id: 'isolated', position: [1, 1, 0], level: 'ground' }
	];
	const link = (id: string, from: string, to: string): MovementLink => ({
		id,
		nodeIds: [from, to],
		cost: 5,
		kind: 'any'
	});
	const links = [
		link('b-start', 'start', 'b'),
		link('b-end', 'b', 'end'),
		link('a-start-2', 'start', 'a'),
		link('a-end', 'a', 'end'),
		link('a-start-1', 'start', 'a')
	];
	const first = createMovementNetwork(nodes, links);
	const reversed = createMovementNetwork([...nodes].reverse(), [...links].reverse());
	const route = first.readRoute('start', 'end');
	expect(route).toEqual(reversed.readRoute('start', 'end'));
	expect(route?.edges.map(({ id }) => id)).toEqual(['a-start-1', 'a-end']);
	expect(route?.lengthM).toBe(10);
	expect(route?.climbM).toBe(4);
	expect(first.readRoute('start', 'isolated')).toBeUndefined();
	expect(first.readComponents().get('isolated')).toBe('isolated');
});

test('measures climbs in traversal direction along caller-provided centerlines', () => {
	const example = movementExample();
	expect(example.readRoute('west', 'east')?.edges[0].kind).toBe('gravel');
	expect(example.readRoute('lookout', 'east')?.climbM).toBe(0);
	expect(example.readRoute('east', 'lookout')?.climbM).toBe(2);
	expect(example.readRoute('east', 'east')).toEqual({
		nodes: ['east'],
		edges: [],
		cost: 0,
		climbM: 0,
		lengthM: 0
	});
});
