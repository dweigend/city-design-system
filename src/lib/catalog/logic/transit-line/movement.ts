import type { Vec3 } from '../parametrik/types';
import {
	edgePath,
	movementNetwork,
	type MovementGraph,
	type MovementElement,
	type MovementPort
} from '../movement-network';
import type { TransitLine } from './contract';
import { resolveTransitProfile, stationEnvelope } from './contract';

/** Exposes station nodes and rail edges along the generated alignment. Capacity is a
 * caller-supplied travellers-per-minute scenario. Track samples between stops retain curvature. */
export function railAlignment(line: TransitLine, capacity: number, samples?: readonly number[]) {
	const profile = resolveTransitProfile(line.kind, line.profile);
	const edges: MovementElement[] = [],
		ports: MovementPort[] = [];
	let previous = -1;
	for (const [i, stop] of line.stops.entries()) {
		const at =
			samples?.[i] ??
			line.path.findIndex(
				(p, j) => j > previous && Math.hypot(...p.map((v, k) => v - stop.position[k])) < 1e-6
			);
		if (at < 0) throw new RangeError('Transit stop is outside its alignment');
		const id = 'transit/' + line.id + '/station/' + i;
		const position = stop.position;
		ports.push({
			id,
			kind: 'station',
			position: [position[0], position[1], position[2] - profile.platformDrop],
			heading: stop.headingRad + Math.PI / 2,
			width:
				line.kind === 'viaduct' ? 2 * stationEnvelope.radius : 2 * stationEnvelope.capsuleRadius,
			headroom:
				line.kind === 'viaduct'
					? stationEnvelope.height
					: 2 * stationEnvelope.capsuleRadius * stationEnvelope.capsuleSquash,
			accepts: ['walkway', 'path', 'bridge']
		});
		if (i)
			edges.push({
				id: id + '/ride',
				from: ports[i - 1].id,
				to: id,
				kind: 'monorail',
				mode: 'rail',
				width: 2 * profile.deckRadius,
				capacity,
				via: line.path.slice(previous + 1, at).map(([x, y, z]) => [x, y, z - profile.platformDrop])
			});
		previous = at;
	}
	return movementNetwork(ports, edges, []);
}

/** Applies the requested passenger throughput to the surveyed rail edges. */
export function transitMovement(line: TransitLine, capacity: number) {
	const graph = line.movement ?? railAlignment(line, capacity);
	return { ports: graph.ports, edges: graph.edges.map((edge) => ({ ...edge, capacity })) };
}

/** Projects the platform-level ride chain onto the track datum in stroke order. */
export function trackPoints(graph: MovementGraph, lift: number): Vec3[] {
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	return graph.edges.flatMap((e, i) =>
		edgePath(e, ports)
			.slice(i ? 1 : 0)
			.map(([x, y, z]): Vec3 => [x, y, z + lift])
	);
}
/** Reads the canonical track. Earlier serialized lines store the centreline directly. */
export function transitTrack(line: TransitLine) {
	return line.movement
		? trackPoints(line.movement, resolveTransitProfile(line.kind, line.profile).platformDrop)
		: line.path;
}

/** Locates station structures at their graph ports and retains the surveyed shaft footing. */
export function stationStops(line: TransitLine) {
	const graph = line.movement;
	if (!graph) return line.stops;
	const lift = resolveTransitProfile(line.kind, line.profile).platformDrop;
	return graph.ports.map((p, i) => ({
		...line.stops[i],
		position: [p.position[0], p.position[1], p.position[2] + lift] as Vec3,
		headingRad: p.heading - Math.PI / 2
	}));
}
