import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { MovementNode } from '../../domain/movement-network';
import { planEdgeGraph } from '../../domain/terrain-grid';
import { readCityParcels, type CityGrid, type CitySite } from '../city-site';
import { parcelClearance } from './parcel-clearance';
import { connectLane } from './lane-links';
import { link, type Link } from './links';

const groundId = (id: string) => 'ground/' + id;

// Exact arithmetic: distance along the bridge starts at zero chainage.
export function groundLanes(site: CitySite, layout: CityGrid) {
	const { grid, plan, selectedCrossings } = layout;
	const holdings = readCityParcels(site, layout);
	const reserved = new Set(holdings.lanes.map(({ edgeId }) => edgeId));
	const { edges: perimeter } = planEdgeGraph(grid);
	const edges = perimeter.filter(({ id }) => reserved.has(id));
	const active = new Set([
		...holdings.lanes.flatMap(({ nodeIds }) => nodeIds),
		...selectedCrossings.flatMap(({ heads }) => heads.map(({ nodeId }) => nodeId))
	]);
	const nodes = new Map<string, MovementNode>(
		grid.vertices
			.filter(({ id }) => active.has(id))
			.map(({ id, position }) => [id, { id: groundId(id), position, level: 'ground' }])
	);
	const portalNodeIds = new Map<string, string>();
	const frontage = new Map<string, MovementNode>();
	const node = (id: string) => required(nodes.get(id), 'ground lane node');
	const portals = Map.groupBy(holdings.portals, ({ laneId }) => laneId);
	const clear = parcelClearance(holdings.parcels);
	const lanes = holdings.lanes.flatMap((lane) =>
		connectLane(
			site,
			lane,
			node(lane.nodeIds[0]),
			node(lane.nodeIds[1]),
			portals.get(lane.id) ?? [],
			frontage,
			portalNodeIds,
			(a, b) => clear.segment(a, b, holdings.linearToleranceM)
		)
	);
	const points = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	const crossings = selectedCrossings.map(({ id, heads: [first, last], path, span }) => {
		const from = node(first.nodeId);
		const to = node(last.nodeId);
		const via = span
			? []
			: path.nodeIds.slice(1, -1).map((id) => required(points.get(id), 'bridge node'));
		const ring = [from.position, ...via, to.position];
		const chainage = [0];
		for (let j = 1; j < ring.length; j++)
			chainage.push(
				chainage[j - 1] + Math.hypot(ring[j][0] - ring[j - 1][0], ring[j][1] - ring[j - 1][1])
			);
		const midpoints = via.map(([x, y], j): Vec3 => [
			x,
			y,
			from.position[2] +
				((to.position[2] - from.position[2]) * chainage[j + 1]) /
					required(chainage.at(-1), 'bridge length')
		]);
		return {
			first: first.nodeId,
			last: last.nodeId,
			bridge: link('bridge/' + id, 'bridge', from, to, midpoints)
		};
	});
	const links: Link[] = [...lanes, ...crossings.map(({ bridge }) => bridge)];
	return { nodes, frontage, portalNodeIds, node, edges, crossings, links, clear };
}
