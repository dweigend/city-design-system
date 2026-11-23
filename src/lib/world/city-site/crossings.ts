import { distance, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { planEdgeGraph, type PlanEdgePath, type TerrainGrid } from '../../domain/terrain-grid';
import type { CityTerrainSampler } from './sampling';

/** A bank-to-bank edge path with the bank node and adjacent built cells at each head. */
export type CityCrossing = Readonly<{
	path: PlanEdgePath;
	heads: readonly [CrossingHead, CrossingHead];
}>;

type CrossingHead = Readonly<{ nodeId: string; cellIds: readonly string[] }>;
type Candidate = CityCrossing & { waterCellIds: readonly string[]; midpoint: Vec2; score: number };
type HeadCell = { id: string; point: Vec2 };

const maximumSpanM = 320;
const crossingSpacingM = 105;
const maximumHeadDepthM = 18;

// The chord identifies the two banks. The edge graph supplies the route and its length.
function crossesChannel(a: Vec2, b: Vec2, sample: CityTerrainSampler) {
	const steps = Math.ceil(distance(a, b) / 5);
	let wet = false;
	let ended = false;
	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		const ground = sample(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]));
		if (ground.dry) {
			ended ||= wet;
			continue;
		}
		if (ended || (ground.waterKind !== 'river' && ground.waterKind !== 'tributary')) return false;
		wet = true;
	}
	return wet;
}

function headCells(plan: TerrainGrid, built: TerrainGrid, wetNodes: ReadonlySet<string>) {
	const vertices = new Map(built.vertices.map(({ id, position }) => [id, position]));
	const planCells = new Map(plan.cells.map((cell) => [cell.id, cell]));
	const heads = new Map<string, HeadCell[]>();
	for (const { id, vertexIds } of built.cells) {
		const original = required(planCells.get(id), 'head plan cell');
		const attached = original.vertexIds.filter((node) => wetNodes.has(node));
		if (!attached.length) continue;
		const point = vertexIds.reduce<Vec2>(
			([x, y], node) => {
				const [a, b] = required(vertices.get(node), 'head cell corner');
				return [x + a / vertexIds.length, y + b / vertexIds.length];
			},
			[0, 0]
		);
		for (const node of attached) {
			const list = heads.get(node) ?? [];
			list.push({ id, point });
			heads.set(node, list);
		}
	}
	return heads;
}

function oppositeHeads(
	a: Vec2,
	b: Vec2,
	first: readonly HeadCell[],
	last: readonly HeadCell[],
	sample: CityTerrainSampler
) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const behind = ({ point: [x, y] }: HeadCell) => (x - a[0]) * dx + (y - a[1]) * dy < 0;
	const beyond = ({ point: [x, y] }: HeadCell) => (x - b[0]) * dx + (y - b[1]) * dy > 0;
	const pairs = first.filter(behind).flatMap((from) =>
		last
			.filter(beyond)
			.filter((to) => crossesChannel(from.point, to.point, sample))
			.map((to) => [from.id, to.id] as const)
	);
	return [
		[...new Set(pairs.map(([from]) => from))],
		[...new Set(pairs.map(([, to]) => to))]
	] as const;
}

export function channelCrossings(
	plan: TerrainGrid,
	built: TerrainGrid,
	sample: CityTerrainSampler,
	core: Vec2
) {
	const cells = new Map(plan.cells.map(({ id, groundKind }) => [id, groundKind]));
	const flowing = (id: string) => cells.get(id) === 'river' || cells.get(id) === 'tributary';
	const graph = planEdgeGraph(
		plan,
		({ cellIds }) =>
			cellIds.length === 2 &&
			cellIds.some(flowing) &&
			cellIds.every((id) => flowing(id) || cells.get(id) === 'dry')
	);
	const byEdge = new Map(graph.edges.map((edge) => [edge.id, edge]));
	const edgeNodes = new Set(graph.edges.flatMap(({ nodeIds }) => nodeIds));
	const heads = headCells(
		plan,
		built,
		new Set(
			[...edgeNodes].filter((id) => sample(...graph.point(id)).waterClearance >= -maximumHeadDepthM)
		)
	);
	const proposals: Candidate[] = [];
	for (const [start, first] of heads) {
		const a = graph.point(start);
		for (const path of graph.pathsFrom(start, (id) => start < id && heads.has(id), maximumSpanM)) {
			const end = required(path.nodeIds.at(-1), 'crossing end');
			const b = graph.point(end);
			if (distance(a, b) < path.lengthM * 0.58) continue;
			const [from, to] = oppositeHeads(a, b, first, required(heads.get(end), 'bank heads'), sample);
			if (!from.length || !to.length) continue;
			const waterCellIds = [
				...new Set(
					path.edges.flatMap(({ id }) =>
						required(byEdge.get(id), 'crossing edge').cellIds.filter(flowing)
					)
				)
			];
			const midpoint: Vec2 = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
			proposals.push({
				path,
				heads: [
					Object.freeze({ nodeId: start, cellIds: Object.freeze(from) }),
					Object.freeze({ nodeId: end, cellIds: Object.freeze(to) })
				],
				waterCellIds,
				midpoint,
				score: path.lengthM + 0.22 * distance(core, midpoint)
			});
		}
	}
	const selected: Candidate[] = [];
	for (const proposal of proposals.sort((a, b) => a.score - b.score)) {
		if (selected.some(({ midpoint }) => distance(midpoint, proposal.midpoint) < crossingSpacingM))
			continue;
		selected.push(proposal);
	}
	return selected;
}
