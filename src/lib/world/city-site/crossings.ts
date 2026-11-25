import { distance, isSegmentIntersection, readVertexMean, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { planEdgeGraph, type PlanEdgePath, type TerrainGrid } from '../../domain/terrain-grid';
import { citySiteConfig as config } from '../../../config/city-site';
import type { CityTerrainReading, CityTerrainSampler } from './sampling';

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
type Segment = readonly [Vec2, Vec2];
type CrossingProposal = { candidate: Candidate; segments: readonly Segment[] };
/** Selects which wet ground kinds may form one continuous crossing. */
export type CrossableWater = (kind: NonNullable<CityTerrainReading['waterKind']>) => boolean;

type HeadCell = { id: string; point: Vec2 };
type ChannelPhase = 'before-wet' | 'in-wet' | 'after-wet';
type WaterKind = CityTerrainReading['waterKind'];

function* waterProbes(a: Vec2, b: Vec2, sample: CityTerrainSampler) {
	const steps = Math.max(1, Math.ceil(distance(a, b) / config.crossingProbeStepM));
	for (let step = 1; step <= steps; step++) {
		const t = step / steps;
		yield sample(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])).waterKind;
	}
}

function advanceChannel(
	phase: ChannelPhase,
	probes: Iterable<WaterKind>,
	crossable: CrossableWater
) {
	for (const kind of probes) {
		if (kind === null) {
			if (phase === 'in-wet') phase = 'after-wet';
		} else {
			if (phase === 'after-wet' || !crossable(kind)) return undefined;
			phase = 'in-wet';
		}
	}
	return phase;
}

function crossesChannel(a: Vec2, b: Vec2, sample: CityTerrainSampler, crossable: CrossableWater) {
	const phase = advanceChannel('before-wet', waterProbes(a, b, sample), crossable);
	return phase !== undefined && phase !== 'before-wet';
}

function headCells(built: TerrainGrid, edgeNodes: ReadonlySet<string>) {
	const vertices = new Map(built.vertices.map(({ id, position }) => [id, position]));
	const heads = new Map<string, HeadCell[]>();
	for (const { id, vertexIds } of built.cells) {
		// Only a plan node retained by the clipped polygon has a buildable landing.
		const attached = vertexIds.filter((node) => edgeNodes.has(node));
		if (!attached.length) continue;
		const point = readVertexMean(
			vertexIds.map((node) => required(vertices.get(node), 'head cell corner')),
			'before-sum'
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
	sample: CityTerrainSampler,
	crossable: CrossableWater
) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const behind = ({ point: [x, y] }: HeadCell) => (x - a[0]) * dx + (y - a[1]) * dy < 0;
	const beyond = ({ point: [x, y] }: HeadCell) => (x - b[0]) * dx + (y - b[1]) * dy > 0;
	const pairs = first.filter(behind).flatMap((from) =>
		last
			.filter(beyond)
			.filter((to) => crossesChannel(from.point, to.point, sample, crossable))
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
	core: Vec2,
	crossable: CrossableWater
) {
	const cells = new Map(plan.cells.map(({ id, groundKind }) => [id, groundKind]));
	const wet = (id: string) => {
		const kind = cells.get(id);
		return kind !== undefined && kind !== 'dry' && crossable(kind);
	};
	const graph = planEdgeGraph(
		plan,
		({ cellIds }) =>
			cellIds.length === 2 &&
			cellIds.some(wet) &&
			cellIds.every((id) => wet(id) || cells.get(id) === 'dry')
	);
	const byEdge = new Map(graph.edges.map((edge) => [edge.id, edge]));
	const edgeNodes = new Set(graph.edges.flatMap(({ nodeIds }) => nodeIds));
	const heads = headCells(built, edgeNodes);
	const forward = new Map<string, readonly WaterKind[]>();
	const backward = new Map<string, readonly WaterKind[]>();
	const traversal = {
		initial: 'before-wet' as ChannelPhase,
		advance(phase: ChannelPhase, { id }: { id: string }, from: string, to: string) {
			const cache = from < to ? forward : backward;
			let probes = cache.get(id);
			if (!probes) {
				probes = [...waterProbes(graph.point(from), graph.point(to), sample)];
				cache.set(id, probes);
			}
			return advanceChannel(phase, probes, crossable);
		},
		accepts: (phase: ChannelPhase) => phase !== 'before-wet'
	};
	const proposals: CrossingProposal[] = [];
	for (const [start, first] of heads) {
		const a = graph.point(start);
		for (const path of graph.pathsFrom(
			start,
			(id) => start < id && heads.has(id),
			config.crossingMaxLengthM,
			undefined,
			traversal
		)) {
			const end = required(path.nodeIds.at(-1), 'crossing end');
			const b = graph.point(end);
			const lengthM = distance(a, b);
			const straightness = lengthM / path.lengthM;
			if (
				straightness < config.minimumPathStraightnessRatio ||
				!crossesChannel(a, b, sample, crossable)
			)
				continue;
			const span =
				straightness < config.straightSpanThresholdRatio
					? Object.freeze({ nodeIds: Object.freeze([start, end] as const), lengthM })
					: undefined;
			const [from, to] = oppositeHeads(
				a,
				b,
				first,
				required(heads.get(end), 'bank heads'),
				sample,
				crossable
			);
			if (!from.length || !to.length) continue;
			const waterCellIds = [
				...new Set(
					path.edges.flatMap(({ id }) =>
						required(byEdge.get(id), 'crossing edge').cellIds.filter(wet)
					)
				)
			];
			const midpoint: Vec2 = [
				(a[0] + b[0]) * /* Exact arithmetic: midpoint of the crossing chord. */ 0.5,
				(a[1] + b[1]) * /* Exact arithmetic: midpoint of the crossing chord. */ 0.5
			];
			const segments = path.edges.map(({ from, to }): Segment => [
				graph.point(from),
				graph.point(to)
			]);
			if (span) segments.push([a, b]);
			proposals.push({
				candidate: {
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
				},
				segments
			});
		}
	}
	const selected: CrossingProposal[] = [];
	for (const proposal of proposals.sort(
		({ candidate: a }, { candidate: b }) =>
			a.score - b.score || (a.id < b.id ? -1 : Number(a.id > b.id))
	)) {
		if (
			selected.some(
				({ candidate: { midpoint }, segments }) =>
					distance(midpoint, proposal.candidate.midpoint) < config.crossingSpacingM ||
					segments.some(([a, b]) =>
						proposal.segments.some(([c, d]) => isSegmentIntersection(a, b, c, d))
					)
			)
		)
			continue;
		selected.push(proposal);
	}
	return selected.map(({ candidate }) => candidate);
}
