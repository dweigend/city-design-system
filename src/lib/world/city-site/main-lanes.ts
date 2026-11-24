import { laneSettings } from '../../../config/lanes';
import { distance, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import {
	planEdgeGraph,
	type PlanEdge,
	type PlanEdgePath,
	type TerrainGrid
} from '../../domain/terrain-grid';

/** An addressed main lane from a crossing head or dry local root. */
export type MainLanePath = PlanEdgePath &
	Readonly<{ id: string; headId: string; crossingId?: string }>;

function guideDistance(point: Vec2, guide: readonly Vec2[]) {
	let nearest = Infinity;
	for (let i = 1; i < guide.length; i++) {
		const [a, b] = [guide[i - 1], guide[i]];
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const t = Math.max(
			0,
			Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy))
		);
		nearest = Math.min(nearest, distance(point, [a[0] + t * dx, a[1] + t * dy]));
	}
	return nearest;
}

/** Indexes one dry carrier. Routes a guide in XY meters from its addressed head, or from
 * the nearest dry node if a crossing is absent. Returns ordered edge IDs and physical length. */
export function createMainLaneRouter(
	grid: TerrainGrid,
	gradeOf?: (edge: PlanEdge) => number,
	isWalkable?: (point: Vec2) => boolean
) {
	const graph = planEdgeGraph(grid);
	const heights = new Map(grid.vertices.map(({ id, position }) => [id, position[2]]));
	const roots = [...heights.keys()].sort();
	return (guide: readonly Vec2[], armKey: string, headId?: string) => {
		const target = guide.at(-1);
		if (!target || guide.length <= 1) return undefined;
		const root =
			headId ??
			roots.reduce<string | undefined>((nearest, node) => {
				const point = graph.point(node);
				if (isWalkable && !isWalkable(point)) return nearest;
				return nearest === undefined ||
					distance(guide[0], point) < distance(guide[0], graph.point(nearest))
					? node
					: nearest;
			}, undefined);
		if (!root) return undefined;

		const costs = new Map<string, number>();
		function cost(edge: PlanEdge) {
			const cached = costs.get(edge.id);
			if (cached !== undefined) return cached;
			const [from, to] = edge.nodeIds;
			const [a, b] = [graph.point(from), graph.point(to)];
			const midpoint: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
			if (isWalkable && (!isWalkable(a) || !isWalkable(b) || !isWalkable(midpoint))) {
				costs.set(edge.id, Infinity);
				return Infinity;
			}
			const offset = guideDistance(midpoint, guide);
			const grade =
				gradeOf?.(edge) ??
				Math.abs(
					required(heights.get(from), 'lane start height') -
						required(heights.get(to), 'lane end height')
				) / edge.lengthM;
			const measured =
				offset > laneSettings.guideSearchM
					? Infinity
					: edge.lengthM *
						(1 + laneSettings.gradeWeightRatio * grade + offset / laneSettings.guideScaleM);
			costs.set(edge.id, measured);
			return measured;
		}

		let nearest = distance(graph.point(root), target);
		let route: PlanEdgePath | undefined;
		for (const path of graph.pathsFrom(
			root,
			(node) => distance(graph.point(node), target) < nearest,
			Infinity,
			cost
		)) {
			const node = required(path.nodeIds.at(-1), 'main lane end');
			const gap = distance(graph.point(node), target);
			nearest = gap;
			route = path;
		}
		if (!route) return undefined;
		const path: MainLanePath = Object.freeze({
			...route,
			id: JSON.stringify([root, armKey]),
			headId: root
		});
		return { path, points: route.nodeIds.map(graph.point) };
	};
}
