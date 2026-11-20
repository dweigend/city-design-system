import { composedProjection } from './composed-projection';
import { transitMovement } from '../transit-line';
import { movementNetwork, type DockRequest, type MovementElement } from '../movement-network';
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
	const lines = world.lines.map((line) => transitMovement(line, railCapacity));
	return movementNetwork(
		[
			...(walk?.ports ?? []),
			...groups.flatMap((g) => g.movement.ports),
			...lines.flatMap((l) => l.ports)
		],
		[
			...(walk?.edges ?? []),
			...groups.flatMap((g) => g.movement.edges),
			...crossing,
			...lines.flatMap((l) => l.edges)
		],
		transfers
	);
}
