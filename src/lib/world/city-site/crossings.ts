import { distance, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { planEdgeGraph, type PlanEdgePath, type TerrainGrid } from '../../domain/terrain-grid';
import { citySiteConfig as config } from './config';
import type { CityTerrainSampler } from './sampling';

/** A bank-to-bank crossing addressed by an edge path, with an optional direct bridge span. */
export type CityCrossing = Readonly<{
	/** Canonical address of this crossing's ordered plan-node path. */
	id: string;
	path: PlanEdgePath;
	/** The straight bridge chord between its two plan nodes, measured in horizontal meters. */
	span?: Readonly<{ nodeIds: readonly [string, string]; lengthM: number }>;
	heads: readonly [CrossingHead, CrossingHead];
}>;

type CrossingHead = Readonly<{ nodeId: string; cellIds: readonly string[] }>;
type Candidate = CityCrossing & {
	waterCellIds: readonly string[];
	midpoint: Vec2;
	score: number;
};
type HeadCell = { id: string; point: Vec2 };

function crossesChannel(points: readonly Vec2[], sample: CityTerrainSampler) {
	let wet = false;
	let ended = false;
	for (let segment = 1; segment < points.length; segment++) {
		const [a, b] = [points[segment - 1], points[segment]];
		const steps = Math.max(1, Math.ceil(distance(a, b) / config.crossingProbeStepM));
		for (let step = 1; step <= steps; step++) {
			const t = step / steps;
			const ground = sample(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]));
			if (ground.waterKind === null) {
				ended ||= wet;
				continue;
			}
			if (ended || (ground.waterKind !== 'river' && ground.waterKind !== 'tributary')) return false;
			wet = true;
		}
	}
	return wet;
}

function headCells(built: TerrainGrid, edgeNodes: ReadonlySet<string>) {
	const vertices = new Map(built.vertices.map(({ id, position }) => [id, position]));
	const heads = new Map<string, HeadCell[]>();
	for (const { id, vertexIds } of built.cells) {
		// Only a plan node retained by the clipped polygon has a buildable landing.
		const attached = vertexIds.filter((node) => edgeNodes.has(node));
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
			.filter((to) => crossesChannel([from.point, to.point], sample))
			.map((to) => [from.id, to.id] as const)
	);
	return [
		[...new Set(pairs.map(([from]) => from))].sort(),
		[...new Set(pairs.map(([, to]) => to))].sort()
	] as const;
}

/** Ranks eligible channel crossings by edge length and proximity to the growth center. */
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
	const heads = headCells(built, edgeNodes);
	const proposals: Candidate[] = [];
	for (const [start, first] of heads) {
		const a = graph.point(start);
		for (const path of graph.pathsFrom(
			start,
			(id) => start < id && heads.has(id),
			config.crossingMaxLengthM
		)) {
			const end = required(path.nodeIds.at(-1), 'crossing end');
			const b = graph.point(end);
			const lengthM = distance(a, b);
			const straightness = lengthM / path.lengthM;
			if (straightness < config.minimumPathStraightnessRatio || !crossesChannel([a, b], sample))
				continue;
			const span =
				straightness < config.straightSpanThresholdRatio
					? Object.freeze({ nodeIds: Object.freeze([start, end] as const), lengthM })
					: undefined;
			const [from, to] = oppositeHeads(a, b, first, required(heads.get(end), 'bank heads'), sample);
			if (!from.length || !to.length || !crossesChannel(path.nodeIds.map(graph.point), sample))
				continue;
			const waterCellIds = [
				...new Set(
					path.edges.flatMap(({ id }) =>
						required(byEdge.get(id), 'crossing edge').cellIds.filter(flowing)
					)
				)
			];
			const midpoint: Vec2 = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
			proposals.push({
				id: JSON.stringify(path.nodeIds),
				path,
				...(span ? { span } : {}),
				heads: [
					Object.freeze({ nodeId: start, cellIds: Object.freeze(from) }),
					Object.freeze({ nodeId: end, cellIds: Object.freeze(to) })
				],
				waterCellIds,
				midpoint,
				score: path.lengthM + config.coreDistanceWeightRatio * distance(core, midpoint)
			});
		}
	}
	const selected: Candidate[] = [];
	for (const proposal of proposals.sort(
		(a, b) => a.score - b.score || (a.id < b.id ? -1 : Number(a.id > b.id))
	)) {
		if (
			selected.some(
				({ midpoint }) => distance(midpoint, proposal.midpoint) < config.crossingSpacingM
			)
		)
			continue;
		selected.push(proposal);
	}
	return selected;
}
