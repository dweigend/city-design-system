import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { MovementNode } from '../../domain/movement-network';
import { planEdges } from '../../domain/terrain-grid';
import { readCityParcels, type CityGrid, type CitySite } from '../city-site';
import { parcelClearance } from './parcel-clearance';
import { connectLane } from './lane-links';
import { link, type Link } from './links';

const groundId = (id: string) => 'ground/' + id;

export function groundSurvey(site: CitySite, layout: CityGrid) {
	const { grid, selectedCrossings } = layout;
	const holdings = readCityParcels(site, layout);
	const reserved = new Set(holdings.lanes.map(({ edgeId }) => edgeId));
	const edges = planEdges(grid).filter(({ id }) => reserved.has(id));
	const active = new Set<string>();
	for (const lane of holdings.lanes) for (const id of lane.nodeIds) active.add(id);
	for (const crossing of selectedCrossings)
		for (const { nodeId } of crossing.heads) active.add(nodeId);
	const nodes = new Map<string, MovementNode>(
		grid.vertices
			.filter(({ id }) => active.has(id))
			.map(({ id, position }) => [id, { id: groundId(id), position, level: 'ground' }])
	);
	const clear = parcelClearance(holdings.parcels);
	return { nodes, edges, clear, holdings };
}

// Exact arithmetic: distance along the bridge starts at zero chainage.
export function groundLanes(site: CitySite, layout: CityGrid) {
	const { plan, selectedCrossings } = layout;
	const { nodes, edges, clear, holdings } = groundSurvey(site, layout);
	const portalNodeIds = new Map<string, string>();
	const frontage = new Map<string, MovementNode>();
	const node = (id: string) => required(nodes.get(id), 'ground lane node');
	const portals = Map.groupBy(holdings.portals, ({ laneId }) => laneId);
	const frontageClear = (a: Vec2, b: Vec2) => clear.segment(a, b, holdings.linearToleranceM);
	const links: Link[] = [];
	for (const lane of holdings.lanes)
		connectLane(
			site,
			lane,
			node(lane.nodeIds[0]),
			node(lane.nodeIds[1]),
			portals.get(lane.id) ?? [],
			frontage,
			portalNodeIds,
			frontageClear,
			links
		);
	const points = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	const crossings = selectedCrossings.map(({ id, heads: [first, last], path, span }) => {
		const from = node(first.nodeId);
		const to = node(last.nodeId);
		const via = span
			? []
			: path.nodeIds.slice(1, -1).map((id) => required(points.get(id), 'bridge node'));
		const ring = [from.position, ...via, to.position];
		const chainage = /* Exact arithmetic: route starts with zero chainage. */ [0];
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
		const bridge = link('bridge/' + id, 'bridge', from, to, midpoints);
		links.push(bridge);
		return {
			first: first.nodeId,
			last: last.nodeId,
			bridge
		};
	});
	return { nodes, frontage, portalNodeIds, node, edges, crossings, links, clear };
}
