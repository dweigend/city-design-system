import { distance, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { TerrainGrid } from '../../domain/terrain-grid';
import type { CityTerrainSampler } from './sampling';

/** Flowing-water cells in adjacency order, with the buildable heads and wet span in meters. */
export type CityCrossing = Readonly<{
	headIds: readonly [string, string];
	waterCellIds: readonly string[];
	spanM: number;
	banks: readonly [Vec2, Vec2];
}>;

type Proposal = CityCrossing & { midpoint: Vec2; score: number };

const maximumSpanM = 220;
const maximumApproachM = 85;
const crossingSpacingM = 105;
const probeStepM = 3;

function wetSpan(a: Vec2, b: Vec2, sample: CityTerrainSampler) {
	const length = distance(a, b);
	if (length > maximumSpanM + 2 * maximumApproachM) return;
	const steps = Math.ceil(length / probeStepM);
	const point = (t: number): Vec2 => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
	let first = 0;
	let last = 0;
	for (let i = 1; i < steps; i++) {
		const ground = sample(...point(i / steps));
		if (ground.dry) continue;
		if (ground.waterKind !== 'river' && ground.waterKind !== 'tributary') return;
		if (!first) first = i;
		else if (i !== last + 1) return;
		last = i;
	}
	if (!first || (first * length) / steps > maximumApproachM) return;
	if (((steps - last) * length) / steps > maximumApproachM) return;
	const banks = [point((first - 0.5) / steps), point((last + 0.5) / steps)] as const;
	const spanM = distance(...banks);
	if (spanM <= maximumSpanM) return { banks, spanM, length };
}

function centers(grid: TerrainGrid) {
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	return new Map(
		grid.cells.map(({ id, vertexIds }) => [
			id,
			vertexIds.reduce<Vec2>(
				([x, y], key) => {
					const [a, b] = required(vertices.get(key), 'cell corner');
					return [x + a / vertexIds.length, y + b / vertexIds.length];
				},
				[0, 0]
			)
		])
	);
}

export function channelCrossings(
	plan: TerrainGrid,
	built: TerrainGrid,
	sample: CityTerrainSampler
) {
	const points = centers(built);
	const cells = new Map(plan.cells.map((cell) => [cell.id, cell]));
	const wet = new Set(
		plan.cells
			.filter(({ groundKind }) => groundKind === 'river' || groundKind === 'tributary')
			.map(({ id }) => id)
	);
	const heads = new Map<string, string[]>();
	for (const id of points.keys()) {
		for (const adjacent of required(cells.get(id), 'head cell').neighbors) {
			if (adjacent === null || !wet.has(adjacent)) continue;
			const shore = heads.get(adjacent) ?? [];
			shore.push(id);
			heads.set(adjacent, shore);
		}
	}

	const proposals = new Map<string, Proposal>();
	const tested = new Map<string, ReturnType<typeof wetSpan>>();
	for (const [start, from] of heads) {
		const paths = new Map<string, readonly string[]>([[start, [start]]]);
		const queue = [start];
		for (const id of queue) {
			const path = required(paths.get(id), 'crossing path');
			for (const a of from) {
				for (const b of heads.get(id) ?? []) {
					if (a >= b) continue;
					const key = JSON.stringify([a, b]);
					const previous = proposals.get(key);
					if (previous && previous.waterCellIds.length <= path.length) continue;
					if (!tested.has(key))
						tested.set(
							key,
							wetSpan(
								required(points.get(a), 'crossing head'),
								required(points.get(b), 'crossing head'),
								sample
							)
						);
					const span = tested.get(key);
					if (!span) continue;
					const { banks, spanM, length } = span;
					proposals.set(key, {
						headIds: [a, b],
						waterCellIds: path,
						banks,
						spanM,
						midpoint: [(banks[0][0] + banks[1][0]) / 2, (banks[0][1] + banks[1][1]) / 2],
						score: spanM + 0.45 * (length - spanM)
					});
				}
			}
			if (path.length >= 5) continue;
			for (const next of required(cells.get(id), 'water cell').neighbors) {
				if (next === null || !wet.has(next) || paths.has(next)) continue;
				paths.set(next, [...path, next]);
				queue.push(next);
			}
		}
	}
	const selected: Proposal[] = [];
	for (const proposal of [...proposals.values()].sort((a, b) => a.score - b.score)) {
		if (selected.some(({ midpoint }) => distance(midpoint, proposal.midpoint) < crossingSpacingM))
			continue;
		selected.push(proposal);
	}
	return Object.freeze(
		selected.map(({ headIds, waterCellIds, banks, spanM }): CityCrossing =>
			Object.freeze({
				headIds: Object.freeze(headIds),
				waterCellIds: Object.freeze(waterCellIds),
				banks: Object.freeze([Object.freeze(banks[0]), Object.freeze(banks[1])] as const),
				spanM
			})
		)
	);
}
