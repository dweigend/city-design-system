import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { MovementNode } from '../../domain/movement-network';
import { planEdgeGraph } from '../../domain/terrain-grid';
import type { CityGrid, CitySite } from '../city-site';
import { defaults } from '../../../config/city-movement';
import { link, type Link } from './links';

const groundId = (id: string) => 'ground/' + id;

function drape(a: Vec3, b: Vec3, site: CitySite): Vec3[] {
	const count = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / defaults.groundTraceStepM);
	return Array.from({ length: Math.max(0, count - 1) }, (_, i) => {
		const t = (i + 1) / count;
		const x = a[0] + (b[0] - a[0]) * t;
		const y = a[1] + (b[1] - a[1]) * t;
		return [x, y, site.sampleGround(x, y).height];
	});
}

/** Source of provisional ground lanes. The parcel lane adapter can replace this function
 * while preserving the stable ground addresses used by the stairs and docks. */
// Exact arithmetic: distance along the bridge starts at zero chainage.
export function groundLanes(site: CitySite, { grid, plan, selectedCrossings }: CityGrid) {
	const nodes = new Map<string, MovementNode>(
		grid.vertices.map(({ id, position }) => [id, { id: groundId(id), position, level: 'ground' }])
	);
	const node = (id: string) => required(nodes.get(id), 'ground lane node');
	const { edges } = planEdgeGraph(grid);
	const lanes = edges.map(({ id, nodeIds: [from, to] }) =>
		link(
			'lane/' + id,
			'lane',
			node(from),
			node(to),
			drape(node(from).position, node(to).position, site)
		)
	);
	const points = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	const crossings = selectedCrossings.map(({ heads: [first, last], path, span }, i) => {
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
			bridge: link('bridge/' + i, 'bridge', from, to, midpoints)
		};
	});
	const links: Link[] = [...lanes, ...crossings.map(({ bridge }) => bridge)];
	return { nodes, node, edges, crossings, links };
}
