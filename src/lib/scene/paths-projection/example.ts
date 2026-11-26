import { createMovementNetwork } from '../../domain/movement-network';
import { projectMovement, projectServicePipe, projectWalkableTube } from './index';

/** Projects a short park boardwalk, with both bindings expressed as metric anchors. */
export function pathsProjectionExample() {
	const a = [0, 0, 2] as const;
	const b = [10, 0, 2] as const;
	const network = createMovementNetwork(
		[
			{ id: 'start', position: a, level: 1 },
			{ id: 'end', position: b, level: 1 }
		],
		[
			{
				id: 'park',
				kind: 'boardwalk',
				nodeIds: ['start', 'end'],
				cost: 10,
				supports: [
					{ base: [0, 0, 0], top: a },
					{ base: [10, 0, 0], top: b }
				]
			}
		]
	);
	return projectMovement(
		network,
		{ boardwalk: 'deck' },
		{
			toLocal: (x, y) => [x, y],
			footprint: { width: 12, depth: 4 }
		}
	);
}

/** Shows an elevated enclosure and a compact water service along fixed runs in meters. */
export function tubeProjectionExample() {
	return {
		walkable: projectWalkableTube('walkway', [
			[0, 0, 4],
			[4, 0, 4],
			[8, 2, 4.4]
		]),
		service: projectServicePipe(
			'water',
			[
				[0, 0, 1],
				[4, 0, 1],
				[4, 0, 3]
			],
			'water',
			{
				jointIndices: [1]
			}
		)
	};
}
