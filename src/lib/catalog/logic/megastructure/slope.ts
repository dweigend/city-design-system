import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../params';
import { chainage } from '../transit-line';
import type { Vec3 } from '../traeger';
export type SurveyGraph = {
	points: readonly (readonly [number, number, number])[];
	links: readonly (readonly [number, number])[];
};
const slopeParams = defineParams({
	maxGrade: numberParam('Maximum rise per run', '', 0.6, [0.01, 0.8, 0.01]),
	landing: numberParam('Landing radius', 'm', 0.8, [0.5, 3, 0.1])
});
type Flight = { a: Vec3; b: Vec3; run: number; count: number };
function flight(
	p: readonly number[],
	q: readonly number[],
	radius: number,
	maxGrade: number
): Flight | undefined {
	const dx = q[0] - p[0],
		dy = q[1] - p[1],
		dz = q[2] - p[2],
		length = Math.hypot(dx, dy),
		run = length - 2 * radius;
	if (run <= 0 || Math.abs(dz) > run * maxGrade) return;
	const t = radius / length;
	const count = Math.round((run + 2 * Math.abs(dz)) / 0.63);
	// Use a continuous ramp where equal steps cannot meet the walking rhythm.
	const rhythm = (run + 2 * Math.abs(dz)) / count;
	const steps =
		dz !== 0 &&
		rhythm >= 0.59 &&
		rhythm <= 0.65 &&
		Math.abs(dz) / count >= 0.14 &&
		Math.abs(dz) / count <= 0.19;
	return {
		a: [p[0] + t * dx, p[1] + t * dy, p[2]],
		b: [q[0] - t * dx, q[1] - t * dy, q[2]],
		run,
		count: steps ? count : 0
	};
}
function routes(graph: SurveyGraph, radius: number, maxGrade: number) {
	const edges = graph.points.map(() => new Map<number, Flight>());
	for (const [a, b] of graph.links) {
		if (!edges[a] || !edges[b]) throw new RangeError('Invalid survey link');
		const f = flight(graph.points[a], graph.points[b], radius, maxGrade);
		if (f) {
			edges[a].set(b, f);
			edges[b].set(a, { ...f, a: f.b, b: f.a });
		}
	}
	return edges;
}
/** Shortest feasible route on surveyed straight terrain edges in meters. Node indices
 * break equal-cost ties. Returns detached flights and level landing centers, or undefined
 * if unreachable. Invalid survey coordinates or node indices throw RangeError. */
export function routeSlope(
	graph: SurveyGraph,
	start: number,
	end: number,
	overrides?: ParamOverrides<typeof slopeParams>
) {
	const { maxGrade, landing } = resolveParams(slopeParams, overrides);
	if (
		!graph.points[start] ||
		!graph.points[end] ||
		graph.points.some((p) => !p.every(Number.isFinite))
	)
		throw new RangeError('Invalid survey');
	const edges = routes(graph, landing, maxGrade),
		distance = graph.points.map(() => Infinity),
		previous = new Map<number, number>();
	const open = new Set(graph.points.keys());
	distance[start] = 0;
	while (open.size) {
		const id = [...open].reduce((a, b) => (distance[a] <= distance[b] ? a : b));
		if (distance[id] === Infinity) return;
		if (id === end) break;
		open.delete(id);
		for (const [next, f] of edges[id]) {
			const cost = distance[id] + 2 * landing + chainage([f.a, f.b])[1];
			if (cost < distance[next]) {
				distance[next] = cost;
				previous.set(next, id);
			}
		}
	}
	const nodes = [end];
	for (let p = previous.get(end); p !== undefined; p = previous.get(p)) nodes.push(p);
	nodes.reverse();
	const flights = nodes.slice(1).flatMap((id, i) => edges[nodes[i]].get(id) ?? []);
	return {
		nodes,
		flights,
		landing,
		centers: nodes.map((i) => [...graph.points[i]] satisfies Vec3)
	};
}
