// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { Group } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { kineticGroups } from './kinetic-groups';

const box = (id: string): Primitive => ({
	id,
	role: 'neu',
	token: '--paper',
	material: 'concrete',
	kind: 'box',
	position: [8, 3, 2],
	size: [1, 1, 1]
});
const build = () => new Group();

test('only a newly inserted body lifts and its position can be replayed out of order', () => {
	const old = box('old');
	const { batches, updates } = kineticGroups('house:1', [old, box('insert')], [old], build, 10);
	const [fixed, moving] = batches;
	updates[0](10.1);
	const falling = moving.position.y;
	expect(falling).toBeCloseTo(0.23095);
	updates[0](15);
	expect(moving.position.y).toBeCloseTo(0);
	updates[0](10.1);
	expect(moving.position.y).toBe(falling);
	expect(fixed.position.y).toBe(0);
});

test('a wind sample moves the crown with its mesh and leaves the planted stem seated', () => {
	const { batches, updates } = kineticGroups(
		'forest:1',
		[box('4/2:trunk0'), box('4/2:tree0')],
		[],
		build
	);
	const [stem, crown] = batches;
	updates[0](3);
	const position = crown.position.clone();
	expect(position.length()).toBeGreaterThan(0);
	updates[0](8);
	expect(crown.position.equals(position)).toBe(false);
	updates[0](3);
	expect(crown.position.equals(position)).toBe(true);
	expect(stem.position.length()).toBe(0);
});
