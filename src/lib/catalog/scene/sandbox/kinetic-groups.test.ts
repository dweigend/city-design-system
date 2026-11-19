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

test('the capsule swings about its seat, replays out of order and leaves its neighbour still', () => {
	const capsule: Primitive = {
		...box('insert'),
		kind: 'capsule',
		from: [7, 3, 2],
		to: [9, 3, 2],
		radius: 1
	};
	const { batches, motion } = kineticGroups('house:1', [box('fixed'), capsule], build, 10);
	const [moving, fixed] = batches;
	motion.sample(10.1);
	const angle = moving.rotation.z;
	expect(angle).toBeGreaterThan(0);
	motion.sample(15);
	expect(moving.rotation.z).toBe(0);
	motion.sample(10.1);
	expect(moving.rotation.z).toBe(angle);
	expect(fixed.position.length()).toBe(0);
});

test('a wind sample moves the crown with its mesh and leaves the planted stem seated', () => {
	const { batches, motion } = kineticGroups(
		'forest:1',
		[box('4/2:trunk0'), box('4/2:tree0')],
		build
	);
	const [stem, crown] = batches;
	motion.sample(3);
	const position = crown.position.clone();
	expect(position.length()).toBeGreaterThan(0);
	motion.sample(8);
	expect(crown.position.equals(position)).toBe(false);
	motion.sample(3);
	expect(crown.position.equals(position)).toBe(true);
	expect(stem.position.length()).toBe(0);
});

test('a roof garden carries its fruit in the wind while the planter stays seated', () => {
	const fruit: Primitive = {
		id: 'roof:fruit0',
		material: 'paper',
		role: 'neu',
		token: '--cat-nature',
		kind: 'sphere',
		position: [4, 5, 8],
		radius: 1
	};
	const { batches, motion } = kineticGroups('house:1', [box('planter'), fruit], build);
	motion.sample(2);
	expect(batches[0].position.length()).toBe(0);
	expect(batches[1].position.length()).toBeGreaterThan(0);
});
