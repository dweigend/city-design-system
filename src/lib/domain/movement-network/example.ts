import { createMovementNetwork, type MovementNode } from './index';

/** Two garden entrances with a short direct path and a longer raised viewing path. */
export function movementExample() {
	const nodes: MovementNode[] = [
		{ id: 'west', position: [0, 0, 0], level: 'ground' },
		{ id: 'east', position: [8, 0, 0], level: 'ground' },
		{ id: 'lookout', position: [4, 2, 2], level: 1 }
	];
	return createMovementNetwork(nodes, [
		{ id: 'garden', kind: 'gravel', nodeIds: ['west', 'east'], cost: 8 },
		{ id: 'lookout-west', kind: 'steps', nodeIds: ['west', 'lookout'], cost: 6 },
		{ id: 'lookout-east', kind: 'steps', nodeIds: ['lookout', 'east'], cost: 6 }
	]);
}
