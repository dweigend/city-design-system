import type { MovementElement, MovementPort } from '../movement-network';
import type { TransitLine } from './contract';
import { resolveTransitProfile, stationEnvelope } from './contract';

/** Exposes station nodes and rail edges along the generated alignment. Capacity is a
 * caller-supplied travellers-per-minute scenario. Track samples between stops retain curvature. */
export function transitMovement(line: TransitLine, capacity: number) {
	const profile = resolveTransitProfile(line.kind, line.profile);
	const edges: MovementElement[] = [],
		ports: MovementPort[] = [];
	let previous = -1;
	for (const [i, stop] of line.stops.entries()) {
		const at = line.path.findIndex(
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
				capacity,
				via: line.path.slice(previous + 1, at).map(([x, y, z]) => [x, y, z - profile.platformDrop])
			});
		previous = at;
	}
	return { ports, edges };
}
