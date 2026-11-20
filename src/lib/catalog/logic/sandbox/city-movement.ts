import { townSections } from './composed-projection';
import { networkGroups } from './network-groups';
import { houseObstacles } from './house-obstacles';
import { transitMovement } from '../transit-line';
import { movementNetwork, type DockRequest } from '../movement-network';
import { corridorInputs } from './city-corridors';
import { surveyTownWalk } from '../walkway-network';
import type { World } from './world-contract';
/** Surveys the pedestrian network and station-to-station rail alignment together. Transfers
 * are supplied by the generator which surveyed both mouths. Rail capacity is travellers/minute. */
export function cityMovementNetwork(
	world: World,
	railCapacity: number,
	transfers: readonly DockRequest[] = [],
	openingSurvey?: Parameters<typeof corridorInputs>[1]
) {
	const inputs = corridorInputs(world, openingSurvey);
	const walk = inputs && surveyTownWalk(...inputs).graph;
	const { sections, layout } = townSections(world);
	const groups = networkGroups(world, sections, layout, houseObstacles(world.grid, world.state));
	const crossing = groups.flatMap((g) => {
		if (
			!('court' in g) ||
			typeof g.court !== 'string' ||
			!walk?.ports.some((p) => p.id === g.court)
		)
			return [];
		const gate = g.graph.ports[0];
		return [
			{
				id: g.id + '/crossing',
				from: g.court,
				to: gate.id,
				kind: 'court' as const,
				mode: 'walk' as const,
				capacity: g.graph.edges[0].capacity
			}
		];
	});
	const lines = world.lines.map((line) => transitMovement(line, railCapacity));
	return movementNetwork(
		[
			...(walk?.ports ?? []),
			...groups.flatMap((g) => g.graph.ports),
			...lines.flatMap((l) => l.ports)
		],
		[
			...(walk?.edges ?? []),
			...groups.flatMap((g) => g.graph.edges),
			...crossing,
			...lines.flatMap((l) => l.edges)
		],
		transfers
	);
}
