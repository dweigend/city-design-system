import { distance, type Vec2, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';

type AddressedPlan = Readonly<{
	vertices: readonly Readonly<{ id: string; position: Vec3 }>[];
	cells: readonly Readonly<{ id: string; vertexIds: readonly string[] }>[];
}>;

/** An undirected edge with a canonical ID, end nodes and incident cells. */
export type PlanEdge = Readonly<{
	id: string;
	nodeIds: readonly [string, string];
	cellIds: readonly string[];
	lengthM: number;
}>;

/** A plan edge oriented in the direction of traversal. */
export type OrientedPlanEdge = Readonly<{ id: string; from: string; to: string }>;

/** A directed walk over plan-grid edges, in traversal order, measured in horizontal meters. */
export type PlanEdgePath = Readonly<{
	nodeIds: readonly string[];
	edges: readonly OrientedPlanEdge[];
	lengthM: number;
}>;

type Visit = { id: string; lengthM: number; via?: PlanEdge; previous?: Visit };

function pathTo(end: Visit): PlanEdgePath {
	const nodeIds: string[] = [];
	const edges: OrientedPlanEdge[] = [];
	for (let step: Visit | undefined = end; step; step = step.previous) {
		nodeIds.push(step.id);
		if (step.via && step.previous)
			edges.push(Object.freeze({ id: step.via.id, from: step.previous.id, to: step.id }));
	}
	return Object.freeze({
		nodeIds: Object.freeze(nodeIds.reverse()),
		edges: Object.freeze(edges.reverse()),
		lengthM: end.lengthM
	});
}

/** Returns an unambiguous edge ID for an unordered pair of plan nodes. */
export function planEdgeId(a: string, b: string) {
	const pair = a < b ? [a, b] : [b, a];
	// The ordinary encoding has one separator. The prefixed encoding is disjoint
	// and preserves any separator already present inside either node ID.
	return a.includes('|') || b.includes('|') ? '||' + JSON.stringify(pair) : pair.join('|');
}

/** Reads unique plan edges in first-incidence order. The ID is independent of direction. */
export function planEdges(grid: AddressedPlan): readonly PlanEdge[] {
	const points = new Map(grid.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
	const point = (id: string) => required(points.get(id), 'edge node');
	const byId = new Map<string, Omit<PlanEdge, 'cellIds'> & { cellIds: string[] }>();
	for (const { id: cellId, vertexIds } of grid.cells) {
		for (const [i, from] of vertexIds.entries()) {
			const to = vertexIds[(i + 1) % vertexIds.length];
			const id = planEdgeId(from, to);
			const edge = byId.get(id);
			if (edge) edge.cellIds.push(cellId);
			else {
				const nodeIds = Object.freeze(from < to ? ([from, to] as const) : ([to, from] as const));
				byId.set(id, { id, nodeIds, cellIds: [cellId], lengthM: distance(point(from), point(to)) });
			}
		}
	}
	return Object.freeze(
		[...byId.values()].map((edge): PlanEdge =>
			Object.freeze({ ...edge, cellIds: Object.freeze(edge.cellIds) })
		)
	);
}

/** Indexes the caller's eligible edges and searches shortest paths by length.
 * Crossings and lanes use the same graph with different filters. */
export function planEdgeGraph(
	grid: AddressedPlan,
	accepts: (edge: PlanEdge) => boolean = () => true
) {
	const points = new Map(grid.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
	const point = (id: string) => required(points.get(id), 'edge-path node');
	const edges = Object.freeze(planEdges(grid).filter(accepts));
	const adjacent = new Map<string, PlanEdge[]>();
	for (const edge of edges) {
		for (const id of edge.nodeIds) {
			const list = adjacent.get(id) ?? [];
			list.push(edge);
			adjacent.set(id, list);
		}
	}

	return {
		edges,
		/** Returns the world XY of an addressed vertex. Unknown nodes throw. */
		point,
		/** Visits destinations by increasing shortest length, with stable ties and a meter bound. */
		*pathsFrom(start: string, targets: (id: string) => boolean, maximumLengthM: number) {
			const origin: Visit = { id: start, lengthM: 0 };
			const best = new Map<string, Visit>([[start, origin]]);
			const pending = [origin];
			while (pending.length) {
				pending.sort((a, b) => b.lengthM - a.lengthM || (a.id < b.id ? 1 : -1));
				const visit = required(pending.pop(), 'pending edge path');
				if (best.get(visit.id) !== visit) continue;
				if (visit.id !== start && targets(visit.id)) yield pathTo(visit);
				for (const via of adjacent.get(visit.id) ?? []) {
					const id = via.nodeIds[0] === visit.id ? via.nodeIds[1] : via.nodeIds[0];
					const lengthM = visit.lengthM + via.lengthM;
					if (lengthM > maximumLengthM || lengthM >= (best.get(id)?.lengthM ?? Infinity)) continue;
					const next = { id, lengthM, via, previous: visit };
					best.set(id, next);
					pending.push(next);
				}
			}
		}
	};
}
