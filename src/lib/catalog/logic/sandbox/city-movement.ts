import { composedProjection } from './composed-projection';
import { transitMovement } from '../transit-line';
import {
	composeMovementGraphs,
	walkingCapacity,
	type DockRequest,
	type MovementElement
} from '../movement-network';
import { cityCorridorPlan } from './city-corridors';
import type { World } from './world-contract';
type Group = ReturnType<typeof composedProjection>[number];
function courtCrossings(group: Group, courts: ReadonlySet<string>): MovementElement[] {
	if (!('court' in group) || typeof group.court !== 'string') return [];
	const [gate, entrance] = group.movement.ports;
	const capacity = group.movement.edges[0].capacity;
	const edges: MovementElement[] = [];
	if (courts.has(group.court))
		edges.push({
			id: group.id + '/crossing',
			from: group.court,
			to: gate.id,
			mode: 'walk',
			kind: 'court',
			capacity
		});
	if ('housePort' in group && typeof group.housePort === 'string')
		edges.push({
			id: group.id + '/house-seam',
			from: entrance.id,
			to: group.housePort,
			mode: 'walk',
			kind: 'dock',
			capacity
		});
	return edges;
}
/** A ground house on a surveyed court is entered across that court at its threshold. */
function courtDoors(groups: readonly Group[], courts: ReadonlySet<string>) {
	const doors = groups.flatMap((g) => (g.door && courts.has(g.door.court) ? [g.door] : []));
	return {
		ports: doors.map((door) => door.port),
		edges: doors.map(({ court, port }): MovementElement => ({
			id: port.id + '/crossing',
			from: court,
			to: port.id,
			mode: 'walk',
			kind: 'court',
			capacity: walkingCapacity(port.width)
		}))
	};
}
/** Surveys the pedestrian network and station-to-station rail alignment together. Transfers
 * are supplied by the generator which surveyed both mouths. Rail capacity is travellers/minute. */
export function cityMovementNetwork(
	world: World,
	railCapacity: number,
	transfers: readonly DockRequest[] = [],
	openingSurvey?: Parameters<typeof cityCorridorPlan>[1]
) {
	const walk = cityCorridorPlan(world, openingSurvey)?.plan.graph;
	const groups = composedProjection(world);
	const courts = new Set(walk?.ports.filter((p) => p.kind === 'court').map((p) => p.id));
	const crossing = groups.flatMap((g) => courtCrossings(g, courts));
	const doors = courtDoors(groups, courts);
	const lines = world.lines.map((line) => transitMovement(line, railCapacity));
	return composeMovementGraphs(
		[
			...(walk ? [walk] : []),
			...groups.map((g) => g.movement),
			{ ports: [], edges: crossing },
			doors,
			...lines
		],
		[],
		transfers
	);
}
