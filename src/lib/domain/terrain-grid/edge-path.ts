import { distance, type Vec2, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { encodePair } from '../../core/ref';
import { MinHeap } from './edge-queue';

type AddressedPlan = Readonly<{
	vertices: readonly Readonly<{
		id: string;
		position: Vec3;
		shore?: Readonly<{ planEdgeId: string; t: number }>;
	}>[];
	cells: readonly Readonly<{ id: string; vertexIds: readonly string[]; groundKind?: string }>[];
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

type Visit = { id: string; lengthM: number; cost: number; via?: PlanEdge; previous?: Visit };

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
	// The published address is also part of carrier RNG keys and saved topology.
	if (a.includes('|') || b.includes('|')) return '||' + encodePair(a, b);
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Reads unique plan edges in first-incidence order. The ID is independent of direction. */
export function planEdges(grid: AddressedPlan): readonly PlanEdge[] {
	const points = new Map(grid.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
	const point = (id: string) => required(points.get(id), 'edge node');
	const byPair = new Map<string, Omit<PlanEdge, 'cellIds'> & { cellIds: string[] }>();
	for (const { id: cellId, vertexIds } of grid.cells) {
		for (const [i, from] of vertexIds.entries()) {
			const to = vertexIds[(i + 1) % vertexIds.length];
			const key = encodePair(from, to);
			const edge = byPair.get(key);
			if (edge) edge.cellIds.push(cellId);
			else {
				const nodeIds = Object.freeze(from < to ? ([from, to] as const) : ([to, from] as const));
				const id = planEdgeId(from, to);
				byPair.set(key, {
					id,
					nodeIds,
					cellIds: [cellId],
					lengthM: distance(point(from), point(to))
				});
			}
		}
	}
	return Object.freeze(
		[...byPair.values()].map((edge): PlanEdge =>
			Object.freeze({ ...edge, cellIds: Object.freeze(edge.cellIds) })
		)
	);
}

/** A walkable segment, with ascending fractions on its original support when present.
 * The dry edge ID always addresses its actual end nodes. */
export type DryPlanEdge = PlanEdge &
	Readonly<{
		provenance:
			| Readonly<{ kind: 'plan'; planEdgeId: string; t0: number; t1: number; forward: boolean }>
			| Readonly<{ kind: 'shore'; cellId: string }>;
		bank: boolean;
	}>;

/** Reads surviving edges of the clipped grid with original plan support and shoreline provenance. */
export function dryPlanEdges(grid: AddressedPlan, plan: AddressedPlan): readonly DryPlanEdge[] {
	const originals = new Map(planEdges(plan).map((edge) => [edge.id, edge]));
	const covers = new Map(plan.cells.map(({ id, groundKind }) => [id, groundKind]));
	const nodes = new Map(grid.vertices.map(({ id, shore }) => [id, shore]));
	return Object.freeze(
		planEdges(grid).map((edge): DryPlanEdge => {
			const [a, b] = edge.nodeIds;
			const first = nodes.get(a);
			const last = nodes.get(b);
			const original = originals.get(first?.planEdgeId ?? last?.planEdgeId ?? edge.id);
			const fraction = (node: string, cut: typeof first) => {
				if (cut && cut.planEdgeId === original?.id) return cut.t;
				return original?.nodeIds[0] === node ? 0 : original?.nodeIds[1] === node ? 1 : undefined;
			};
			const ta = fraction(a, first);
			const tb = fraction(b, last);
			if (original && ta !== undefined && tb !== undefined) {
				const bank =
					edge.cellIds.length === 1 &&
					original.cellIds.some((id) => {
						const cover = covers.get(id);
						return cover !== undefined && cover !== 'dry';
					});
				return Object.freeze({
					...edge,
					provenance: Object.freeze({
						kind: 'plan',
						planEdgeId: original.id,
						t0: Math.min(ta, tb),
						t1: Math.max(ta, tb),
						forward: ta < tb
					}),
					bank
				});
			}
			return Object.freeze({
				...edge,
				provenance: Object.freeze({ kind: 'shore', cellId: edge.cellIds[0] }),
				bank: true
			});
		})
	);
}

function compareVisits(a: Visit, b: Visit) {
	const first = a.via?.id ?? '';
	const second = b.via?.id ?? '';
	return (
		a.cost - b.cost ||
		(first < second ? -1 : Number(first > second)) ||
		(a.id < b.id ? -1 : Number(a.id > b.id))
	);
}

/** Indexes the caller's eligible edges once. Searches by length unless given a measured cost. */
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
		/** Visits destinations by increasing shortest cost with stable edge ties.
		 * The bound is in cost units. Positive edge costs are required; Infinity excludes an edge. */
		*pathsFrom(
			start: string,
			targets: (id: string) => boolean,
			maximumCost: number,
			measure?: (edge: PlanEdge) => number
		) {
			const origin: Visit = /* Exact arithmetic: path starts with zero length and cost. */ {
				id: start,
				lengthM: 0,
				cost: 0
			};
			const best = new Map<string, Visit>([[start, origin]]);
			// Keep the original node tie order for the existing length-only crossing search.
			const compare = measure
				? compareVisits
				: (a: Visit, b: Visit) => a.cost - b.cost || (a.id < b.id ? -1 : Number(a.id > b.id));
			const pending = new MinHeap(compare);
			pending.add(origin);
			for (let visit = pending.take(); visit; visit = pending.take()) {
				if (best.get(visit.id) !== visit) continue;
				if (visit.id !== start && targets(visit.id)) yield pathTo(visit);
				for (const via of adjacent.get(visit.id) ?? []) {
					const id = via.nodeIds[0] === visit.id ? via.nodeIds[1] : via.nodeIds[0];
					const cost = visit.cost + (measure?.(via) ?? via.lengthM);
					if (!Number.isFinite(cost) || cost > maximumCost) continue;
					const next = { id, cost, lengthM: visit.lengthM + via.lengthM, via, previous: visit };
					const previous = best.get(id);
					if (previous && compare(next, previous) >= 0) continue;
					best.set(id, next);
					pending.add(next);
				}
			}
		}
	};
}
