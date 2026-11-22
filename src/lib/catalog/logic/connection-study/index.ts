import { connections, connectionStock } from './fixture';
import {
	edgePath,
	movementNetwork,
	pedestrianHeadroom,
	walkingCapacity
} from '../movement-network';
import { projectWalkingEdges } from '../walkway-network';
import type { Primitive } from '../parametrik/types';

const walking = connections.flatMap(({ walkingKind, ...connection }) =>
	walkingKind ? [{ ...connection, kind: walkingKind }] : []
);
const width = 1.8;
const graph = movementNetwork(
	walking.flatMap(({ id, kind, points }) => [
		{
			id: id + '/network',
			kind,
			position: points[0],
			heading: 0,
			width,
			headroom: pedestrianHeadroom,
			accepts: ['entrance']
		},
		{
			id: id + '/door',
			kind: 'entrance',
			position: points[points.length - 1],
			heading: -Math.PI / 2,
			width,
			headroom: pedestrianHeadroom,
			accepts: ['bridge', 'path']
		}
	]),
	walking.map(({ id, kind, points }) => ({
		id,
		from: id + '/network',
		to: id + '/door',
		kind,
		mode: 'walk',
		capacity: walkingCapacity(width),
		via: points.slice(1, -1)
	})),
	[]
);
const ports = new Map(graph.ports.map((port) => [port.id, port]));

/** Uses the same surveyed centrelines for the neutral walking surfaces and their annotations. */
export const connectionViews = connections.map((connection) => {
	const edge = graph.edges.find(({ id }) => id === connection.id);
	return { ...connection, points: edge ? edgePath(edge, ports) : connection.points };
});

const paperSurface = { role: 'bestand', material: 'paper' } as const;
const paperSlots = {
	walking: paperSurface,
	bearing: paperSurface,
	guard: paperSurface
} as const;

/** Fixed cut of the district, with shared-engine surfaces for the two movement links. */
export const connectionSection: Primitive[] = [
	...connectionStock,
	...projectWalkingEdges(graph, () => 0, [], paperSlots)
];
