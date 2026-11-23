import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { Random } from '../../core/random';
import type { TerrainGrid } from '../terrain-grid';

export type DistrictKind = 'detached' | 'block' | 'center';
export type DistrictCell = Readonly<{ districtId: string; kind: DistrictKind; levels: number }>;

type Graph = ReadonlyMap<string, readonly string[]>;
type Cell = Readonly<{ id: string; rank: number }>;

function connected(graph: Graph, included: ReadonlySet<string>) {
	const first = included.values().next().value;
	if (first === undefined) return false;
	const queue = [first];
	const visited = new Set(queue);
	for (const id of queue) {
		for (const neighbor of required(graph.get(id), 'district neighbors')) {
			if (!included.has(neighbor) || visited.has(neighbor)) continue;
			visited.add(neighbor);
			queue.push(neighbor);
		}
	}
	return visited.size === included.size;
}

function grow(
	graph: Graph,
	candidates: readonly Cell[],
	group: Set<string>,
	remainder: Set<string>,
	limit: number,
	start: ReadonlySet<string> = group
) {
	const frontier = new Set(
		[...start].flatMap((id) => [...required(graph.get(id), 'district seed')])
	);
	while (group.size < limit) {
		const next = candidates.find(({ id }) => {
			if (!frontier.has(id) || !remainder.delete(id)) return false;
			if (connected(graph, remainder)) return true;
			remainder.add(id);
			return false;
		});
		if (!next) break;
		if (group.size === 0) frontier.clear();
		group.add(next.id);
		for (const neighbor of required(graph.get(next.id), 'district neighbors'))
			frontier.add(neighbor);
	}
}

function splitBlocks(graph: Graph, pool: ReadonlySet<string>, random: Random, count: number) {
	const seeds = [...pool]
		.map((id) => ({ id, rank: random.derive(id).number() }))
		.sort((a, b) => a.rank - b.rank)
		.slice(0, count);
	const districts = seeds.map(({ id }) => new Set([id]));
	const claimed = new Set(seeds.map(({ id }) => id));
	const queue = seeds.map(({ id }, district) => ({ id, district }));
	for (const { id, district } of queue) {
		for (const neighbor of required(graph.get(id), 'block neighbors')) {
			if (!pool.has(neighbor) || claimed.has(neighbor)) continue;
			claimed.add(neighbor);
			districts[district].add(neighbor);
			queue.push({ id: neighbor, district });
		}
	}
	return districts;
}

function rankedInterior(plan: TerrainGrid, origin: Vec2, random: Random, complexity: number) {
	const vertices = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	const shift = random.derive('center-offset');
	const outline = random.derive('outline');
	const offset = { min: -12, max: 12 };
	const ox = origin[0] + shift.number(offset);
	const oy = origin[1] + shift.number(offset);
	return plan.cells
		.filter(({ neighbors }) => neighbors.every((id) => id !== null))
		.map(({ id, vertexIds }) => {
			const [x, y] = vertexIds.reduce(
				([x, y], corner) => {
					const [u, v] = required(vertices.get(corner), 'district corner');
					return [x + (u - ox) / vertexIds.length, y + (v - oy) / vertexIds.length];
				},
				[0, 0]
			);
			const roughness = outline.derive(id).number() - 0.5;
			return { id, rank: Math.hypot(x, y) + roughness * (5 + 14 * complexity) };
		})
		.sort((a, b) => a.rank - b.rank);
}

function fragmentDistricts(
	graph: Graph,
	interior: readonly Cell[],
	block: Set<string>,
	undeveloped: Set<string>,
	random: Random,
	complexity: number
) {
	const secondary = new Set<string>();
	const all = new Set(graph.keys());
	if (complexity >= 0.75) {
		const outer = [...interior].reverse();
		// Prefer an outer seed in the block band. Sparse cores can use an unclaimed interior cell.
		grow(graph, outer, secondary, block, block.size >= 5 ? 2 : 0, block);
		if (!secondary.size) grow(graph, outer, secondary, undeveloped, 1, all);
	}
	const blocks = splitBlocks(
		graph,
		block,
		random.derive('blocks'),
		1 + Math.floor(2 * complexity + 0.25)
	);
	if (complexity >= 0.75 && blocks.length < 2) {
		const extra = new Set<string>();
		grow(graph, interior, extra, undeveloped, 1, all);
		if (extra.size) blocks.push(extra);
	}
	return { secondary, blocks };
}

export function seedDistricts(
	plan: TerrainGrid,
	origin: Vec2,
	seed: number,
	complexity: number,
	peak: number
) {
	const random = Random.create({ seed }).derive('city-districts');
	const graph: Graph = new Map(
		plan.cells.map(({ id, neighbors }) => [id, neighbors.filter((neighbor) => neighbor !== null)])
	);
	const undeveloped = new Set(graph.keys());
	const interior = rankedInterior(plan, origin, random, complexity);
	const first = interior.find(({ id }) => {
		undeveloped.delete(id);
		if (connected(graph, undeveloped)) return true;
		undeveloped.add(id);
		return false;
	});
	if (!first) throw new RangeError('The initial city plan needs an interior district seed');

	// The connected outer belt retains every initial cell that can attach future growth.
	const center = new Set([first.id]);
	const size = random.derive('district-size').number({ min: 0.85, max: 1.15 });
	grow(
		graph,
		interior,
		center,
		undeveloped,
		Math.max(2, Math.round(interior.length * 0.16 * size))
	);
	const block = new Set<string>();
	grow(
		graph,
		interior,
		block,
		undeveloped,
		Math.max(3, Math.round(interior.length * 0.57 * size)),
		center
	);
	if (!block.size) throw new RangeError('The initial city plan needs room for a block district');

	const { secondary, blocks } = fragmentDistricts(
		graph,
		interior,
		block,
		undeveloped,
		random,
		complexity
	);
	const cells = new Map<string, DistrictCell>();
	for (const [index, district] of blocks.entries()) {
		for (const id of district)
			cells.set(id, Object.freeze({ districtId: `block/${index}`, kind: 'block', levels: 3 }));
	}
	for (const [id, group, top] of [
		['center/0', center, peak],
		['center/1', secondary, Math.min(peak - 1, Math.max(4, Math.round(peak * 0.52)))]
	] as const) {
		const tierFractions = [1, 0.64, 0.38];
		const towers = Math.min(tierFractions.length, Math.ceil(group.size / 3));
		const tiers = new Map(
			[...group]
				.filter((_, index) => index % 2 === 0)
				.slice(0, towers)
				.map((cell, index) => [cell, Math.max(4, 3 + Math.round((top - 3) * tierFractions[index]))])
		);
		for (const cell of group) {
			cells.set(
				cell,
				Object.freeze({ districtId: id, kind: 'center', levels: tiers.get(cell) ?? 3 })
			);
		}
	}
	return cells;
}
