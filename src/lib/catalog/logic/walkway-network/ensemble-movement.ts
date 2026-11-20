import type { MovementElement, MovementPort } from '../movement-network';
import { required } from '../required';
import { type Network, width } from './types';
import { walkingConnectionProfile } from './walking-connection';

/** Maps the surveyed house entrance tree, deck and flight centrelines into city port IDs. */
export function ensembleMovement(id: string, network: Network) {
	const key = (node: string) => id + '/' + node;
	const headings = new Map<string, number>();
	const edges = network.edges.map((edge): MovementElement => {
		const { points } = edge;
		for (const [node, a, b] of [
			[edge.from, points[0], points[1]],
			[edge.to, points[points.length - 1], points[points.length - 2]]
		] as const)
			headings.set(node, Math.atan2(b[1] - a[1], b[0] - a[0]));
		return {
			id: key(edge.id),
			kind: edge.kind === 'ground' ? 'path' : edge.kind === 'deck' ? 'walkway' : edge.kind,
			mode: 'walk',
			from: key(edge.from),
			to: key(edge.to),
			via: points.slice(1, -1),
			capacity: (walkingConnectionProfile.capacity * width) / walkingConnectionProfile.width
		};
	});
	const ports = network.nodes.map((n): MovementPort => ({
		id: key(n.id),
		position: n.position,
		heading: required(headings.get(n.id), 'entrance tree heading'),
		width,
		headroom: walkingConnectionProfile.headroom,
		kind: n.houses.length ? 'entrance' : n.kind === 'stair' ? 'stair' : 'path',
		accepts: ['entrance', 'path', 'walkway', 'ramp', 'stair', 'bridge']
	}));
	return { ports, edges };
}
