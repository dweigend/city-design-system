import { distance, measurePolygon, type Vec2 } from '../src/lib/core/geometry';
import { required } from '../src/lib/core/invariant';
import { planEdges, shorelineMorphLimits, type TerrainGrid } from '../src/lib/domain/terrain-grid';
import {
	cityBankSetbackM,
	type CityCrossing,
	type CityTerrainSampler
} from '../src/lib/world/city-site';

type ShorePlan = Readonly<{
	grid: TerrainGrid;
	plan: TerrainGrid;
	selectedCrossings: readonly CityCrossing[];
}>;

/** Measures the grid's existing bank edges, occupied cells clipped by the setback, and selected crossings. */
export function shoreMetrics(
	{ grid, plan, selectedCrossings }: ShorePlan,
	ground: CityTerrainSampler
) {
	const points = new Map(plan.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
	const point = (id: string) => required(points.get(id), 'plan point');
	const stageCells = new Map(plan.cells.map(({ id, groundKind }) => [id, groundKind]));
	const adjacent = new Set<string>();
	let shoreEdges = 0;
	let alignedEdges = 0;
	for (const {
		cellIds,
		nodeIds: [a, b]
	} of planEdges(plan)) {
		if (cellIds.length !== 2 || cellIds.filter((id) => stageCells.get(id) === 'dry').length !== 1)
			continue;
		const [x, y] = point(a);
		const [u, v] = point(b);
		shoreEdges++;
		for (const id of cellIds) if (stageCells.get(id) === 'dry') adjacent.add(id);
		if (
			[point(a), [(x + u) * 0.5, (y + v) * 0.5] as const, point(b)].every(
				(p) =>
					Math.abs(ground(...p).waterClearance - cityBankSetbackM) <=
					shorelineMorphLimits.bankToleranceM
			)
		)
			alignedEdges++;
	}
	let minAreaM2 = Infinity;
	let maxAreaM2 = 0;
	let minAngleDeg = Infinity;
	let maxEdgeRatio = 0;
	for (const { vertexIds } of plan.cells) {
		const ring = vertexIds.map(point);
		const { area, centroid } = measurePolygon(ring);
		if (
			!centroid ||
			Math.abs(ground(...centroid).waterClearance - cityBankSetbackM) >= shorelineMorphLimits.bandM
		)
			continue;
		minAreaM2 = Math.min(minAreaM2, area);
		maxAreaM2 = Math.max(maxAreaM2, area);
		const edges = ring.map(([x, y], i) => {
			const [a, b] = ring[(i + 1) % ring.length];
			const [u, v] = ring[(i + ring.length - 1) % ring.length];
			const angle = Math.atan2(
				(a - x) * (v - y) - (b - y) * (u - x),
				(a - x) * (u - x) + (b - y) * (v - y)
			);
			minAngleDeg = Math.min(minAngleDeg, angle * (180 / Math.PI));
			return Math.hypot(a - x, b - y);
		});
		maxEdgeRatio = Math.max(maxEdgeRatio, Math.max(...edges) / Math.min(...edges));
	}
	const planCells = new Map(plan.cells.map((cell) => [cell.id, cell]));
	let clipped = 0;
	let occupiedShore = 0;
	for (const { id, vertexIds } of grid.cells) {
		const original = required(planCells.get(id), 'occupied plan cell').vertexIds;
		const cut =
			original.length !== vertexIds.length || original.some((node, i) => node !== vertexIds[i]);
		if (cut) clipped++;
		if (cut || adjacent.has(id)) occupiedShore++;
	}
	const unclippedShare = occupiedShore ? 1 - clipped / occupiedShore : null;
	const alignedShare = shoreEdges ? alignedEdges / shoreEdges : null;
	return {
		clipped,
		occupiedShore,
		unclippedShare,
		alignedShare,
		unclippedTargetMet:
			unclippedShare === null ? null : unclippedShare >= shorelineMorphLimits.targetUnclippedShare,
		alignedTargetMet:
			alignedShare === null ? null : alignedShare >= shorelineMorphLimits.targetAlignedEdgeShare,
		shoreEdges,
		alignedEdges,
		minAreaM2: Number.isFinite(minAreaM2) ? minAreaM2 : 0,
		maxAreaM2,
		minAngleDeg: Number.isFinite(minAngleDeg) ? minAngleDeg : 0,
		maxEdgeRatio,
		straightSpans: selectedCrossings.filter(({ span }) => span).length,
		straightness: selectedCrossings.map(
			({ heads: [first, second], path }) =>
				distance(point(first.nodeId), point(second.nodeId)) / path.lengthM
		),
		renderedStraightness: selectedCrossings.map(
			({ heads: [first, second], path, span }) =>
				distance(point(first.nodeId), point(second.nodeId)) / (span?.lengthM ?? path.lengthM)
		)
	};
}
