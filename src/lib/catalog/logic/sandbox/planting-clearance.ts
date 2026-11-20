import { edgePath } from '../movement-network';
import { cityCorridorPlan } from './city-corridors';
import type { World } from './world-contract';

/** Tests a planting footprint against the full width of the finished walking alignment. */
export function plantingClearance(world: World) {
	const graph = cityCorridorPlan(world)?.plan.graph;
	if (!graph) return () => true;
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const segments = graph.edges.flatMap((edge) => {
		const path = edgePath(edge, ports);
		return path.slice(1).map(([x, y], i) => {
			const [ax, ay] = path[i],
				dx = x - ax,
				dy = y - ay;
			return { ax, ay, dx, dy, lengthSquared: dx * dx + dy * dy, margin: edge.width / 2 + 0.12 };
		});
	});
	return (x: number, y: number, radius: number) =>
		segments.every((s) => {
			const u = x - s.ax,
				v = y - s.ay;
			const t = s.lengthSquared
				? Math.max(0, Math.min(1, (u * s.dx + v * s.dy) / s.lengthSquared))
				: 0;
			return (u - t * s.dx) ** 2 + (v - t * s.dy) ** 2 > (radius + s.margin) ** 2;
		});
}
