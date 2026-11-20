import {
	edgePath,
	movementNetwork,
	walkingCapacity,
	pedestrianHeadroom,
	type MovementPort
} from '../movement-network';
import type { Vec3 } from '../parametrik/types';
import type { Section } from './types';

export const bridgeWidth = 2.5;

/** Exposes each generated deck threshold under its owner's stable address. */
export function houseMovementPorts(section: Section): MovementPort[] {
	return section.composition.ports.map(({ position }, i) => ({
		id: section.id + '/port/' + i,
		kind: 'entrance',
		position,
		heading: Math.atan2(position[1] - section.base[1], position[0] - section.base[0]),
		width: bridgeWidth,
		headroom: pedestrianHeadroom,
		accepts: ['bridge', 'walkway', 'path', 'ramp', 'stair', 'court']
	}));
}
function endSteps(route: Vec3[], thresholds: readonly [number, number]) {
	const transition = ([x, y, z]: Vec3, neighbor: Vec3): Vec3 => {
		const dx = neighbor[0] - x,
			dy = neighbor[1] - y;
		const run = Math.hypot(dx, dy);
		const reach = Math.min(run / 4, 0.6);
		return [x + (dx * reach) / run, y + (dy * reach) / run, z];
	};
	const path = [...route];
	const last = route.length - 1;
	if (thresholds[1] !== route[last][2]) {
		path[last] = [route[last][0], route[last][1], thresholds[1]];
		path.splice(last, 0, transition(route[last], route[last - 1]));
	}
	if (thresholds[0] !== route[0][2]) {
		path[0] = [route[0][0], route[0][1], thresholds[0]];
		path.splice(1, 0, transition(route[0], route[1]));
	}
	return path;
}

/** Fits the threshold transitions before measuring and projecting the inter-house bridge. */
export function bridgeMovement(id: string, route: Vec3[], from: MovementPort, to: MovementPort) {
	const path = endSteps(route, [from.position[2], to.position[2]]);
	const ports = [from, to];
	const graph = movementNetwork(
		ports,
		[
			{
				id,
				kind: 'bridge',
				mode: 'walk',
				width: bridgeWidth,
				capacity: walkingCapacity(bridgeWidth),
				from: from.id,
				to: to.id,
				via: path.slice(1, -1)
			}
		],
		[]
	);
	return {
		graph,
		path: edgePath(graph.edges[0], new Map(ports.map((p) => [p.id, p]))).map((p): Vec3 => [...p])
	};
}
