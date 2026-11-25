import { expect, test } from 'bun:test';
import { distance, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { dryPlanEdges, planEdgeGraph, TerrainGrid } from '../../domain/terrain-grid';
import { createMainLaneRouter } from './main-lanes';
import { channelCrossings } from './crossings';
import {
	citySiteConfig,
	createCitySite,
	readCityGrid,
	riverCityRecipe,
	type CityTerrainSampler
} from './index';

for (const [seed, relief, runoff, variant] of [
	[1201, 0, 1, 'square'],
	[1201, 0, 1, 'hex'],
	[42, 1, 0.5, 'organic']
] as const) {
	test(`validates built landings, wet routes and bridge chords on ${variant} at relief ${relief}`, () => {
		const city = createCitySite(undefined, { seed, relief, runoff });
		const { grid, plan, crossings } = readCityGrid(city, 2600, variant, seed);
		const built = new Map(grid.cells.map((cell) => [cell.id, cell]));
		const graph = planEdgeGraph(plan);
		expect(crossings.length).toBeGreaterThan(0);
		for (const { path, span, heads } of crossings) {
			for (const head of heads) {
				expect(head.cellIds.length).toBeGreaterThan(0);
				for (const id of head.cellIds)
					expect(required(built.get(id), 'built landing').vertexIds).toContain(head.nodeId);
			}
			const endpoints = [path.nodeIds[0], required(path.nodeIds.at(-1), 'end node')] as const;
			const chordM = distance(graph.point(endpoints[0]), graph.point(endpoints[1]));
			if (chordM / path.lengthM < citySiteConfig.straightSpanThresholdRatio)
				expect(span).toEqual({ nodeIds: endpoints, lengthM: chordM });
			else expect(span).toBeUndefined();
			let wet = false;
			for (const { from, to } of path.edges) {
				const [[x, y], [u, v]] = [graph.point(from), graph.point(to)];
				const count = Math.ceil(Math.hypot(u - x, v - y) / citySiteConfig.crossingProbeStepM);
				for (let index = 1; index <= count; index++) {
					const t = index / count;
					const { waterKind } = city.sampleGround(x + (u - x) * t, y + (v - y) * t);
					wet ||= waterKind === 'river' || waterKind === 'tributary';
				}
			}
			expect(wet).toBe(true);
		}
	}, 30_000);
}

function clippedBank() {
	const clearanceAt = (x: number, y: number) => Math.abs(Math.hypot(x, y) - 130) - 48;
	const sample: CityTerrainSampler = (x, y) => {
		const waterClearance = clearanceAt(x, y);
		return waterClearance >= 0
			? { height: 0, waterClearance, waterKind: null }
			: { height: 0, waterClearance, waterKind: 'river', waterHeight: 1 };
	};
	const { grid, plan } = TerrainGrid.createPlan(
		{
			seed: 1201,
			variant: 'square',
			parameters: { cellSize: 60 },
			site: { origin: [0, 0], bearing: 0, length: 720, width: 240 },
			heightAt: () => 0,
			shore: { clearanceAt, minimumEdge: 2, minimumArea: 200 }
		},
		([x, y]) => sample(x, y).waterKind ?? 'dry'
	);
	return { grid, plan, sample };
}

test('equal scores select the same crossings if built polygons are reversed', () => {
	const { grid, plan, sample } = clippedBank();
	const core: Vec2 = [0, 30];
	const ranked = channelCrossings(plan, grid, sample, core, riverCityRecipe.isCrossable);
	expect(ranked.length).toBeGreaterThan(0);
	const reversed = { ...grid, cells: [...grid.cells].reverse() };
	expect(channelCrossings(plan, reversed, sample, core, riverCityRecipe.isCrossable)).toEqual(
		ranked
	);
});

test('routes from a real crossing head over addressed clipped bank intervals', () => {
	const { grid, plan, sample } = clippedBank();
	const crossing = required(
		channelCrossings(plan, grid, sample, [0, 30], riverCityRecipe.isCrossable)[0],
		'crossing'
	);
	const dry = dryPlanEdges(grid, plan);
	expect(
		dry.some(
			({ provenance }) => provenance.kind === 'plan' && (provenance.t0 > 0 || provenance.t1 < 1)
		)
	).toBe(true);
	expect(dry.some(({ provenance, bank }) => provenance.kind === 'shore' && bank)).toBe(true);
	for (const { nodeId } of crossing.heads) {
		const graph = planEdgeGraph(grid);
		const edge = required(
			graph.edges.find(({ nodeIds }) => nodeIds.includes(nodeId)),
			'head edge'
		);
		const next = required(
			edge.nodeIds.find((id) => id !== nodeId),
			'adjacent dry node'
		);
		const guide = [graph.point(nodeId), graph.point(next)];
		const { path, points } = required(
			createMainLaneRouter(grid)(guide, 'arm/0', nodeId),
			'dry arm'
		);
		expect(path.nodeIds[0]).toBe(nodeId);
		expect(path.lengthM).toBeCloseTo(
			points.slice(1).reduce((m, point, i) => m + distance(points[i], point), 0)
		);
		expect(path.edges.every(({ id }) => dry.some((edge) => edge.id === id))).toBe(true);
	}
});

test('a main lane walks the square grid with its physical length', () => {
	const square = TerrainGrid.create({
		seed: 1201,
		variant: 'square',
		parameters: { cellSize: 60 },
		site: { origin: [0, 0], bearing: 0, length: 300, width: 300 },
		heightAt: () => 0
	});
	const { path, points } = required(
		createMainLaneRouter(square)(
			[
				[0, 0],
				[60, 0],
				[60, 120]
			],
			'arm/0'
		),
		'example route'
	);
	expect(path.headId).toBe(path.nodeIds[0]);
	expect(points[0]).toEqual([0, 0]);
	expect(points.at(-1)).toEqual([60, 120]);
	expect(path.lengthM).toBe(180);
	expect(path.edges).toHaveLength(3);
	expect(path.edges.map(({ from }) => from)).toEqual(path.nodeIds.slice(0, -1));
});

test('accepts a crossing policy for a non-river channel', () => {
	const sample: CityTerrainSampler = (x) => {
		const waterClearance = Math.abs(x) - 46;
		return waterClearance >= 0
			? { height: 0, waterClearance, waterKind: null }
			: { height: 0, waterClearance, waterKind: 'water', waterHeight: 1 };
	};
	const city = createCitySite(sample, {
		recipe: {
			isCrossable: (kind) => kind === 'water'
		}
	});
	const { selectedCrossings, plan } = readCityGrid(city, 2600, 'square');
	expect(selectedCrossings.length).toBeGreaterThan(0);
	const graph = planEdgeGraph(plan);
	for (const {
		heads: [first, second]
	} of selectedCrossings) {
		expect(graph.point(first.nodeId)[0] * graph.point(second.nodeId)[0]).toBeLessThan(0);
	}
}, 20_000);

test('main-lane router refuses edges rejected by a custom walkability predicate', () => {
	const grid: TerrainGrid = {
		vertices: [
			{ id: 'v0', position: [0, 0, 0] },
			{ id: 'v1', position: [50, 0, 0] },
			{ id: 'v2', position: [100, 0, 0] },
			{ id: 'v3', position: [50, 40, 0] },
			{ id: 'v4', position: [100, 40, 0] },
			{ id: 'v5', position: [0, 40, 0] }
		],
		cells: [
			{ id: 'c0', vertexIds: ['v0', 'v1', 'v3', 'v5'], neighbors: [null, 'c1', null, null] },
			{ id: 'c1', vertexIds: ['v1', 'v2', 'v4', 'v3'], neighbors: [null, null, null, 'c0'] }
		],
		boundary: []
	};
	const guide: readonly Vec2[] = [
		[0, 0],
		[100, 0]
	];
	const direct = createMainLaneRouter(grid)(guide, 'a', 'v0');
	expect(direct?.path.nodeIds).toEqual(['v0', 'v1', 'v2']);
	const detour = createMainLaneRouter(grid, undefined, ([x, y]) => !(x === 50 && y === 0))(
		guide,
		'a',
		'v0'
	);
	expect(detour).toBeDefined();
	expect(detour?.path.nodeIds).not.toContain('v1');
});

function crossingProbe(
	points: Record<string, Vec2>,
	faces: readonly (readonly string[])[],
	landings: readonly string[],
	clearance: (x: number, y: number) => number
) {
	const vertices: TerrainGrid['vertices'] = Object.entries(points).map(([id, [x, y]]) => ({
		id,
		position: [x, y, 0]
	}));
	const cells: TerrainGrid['cells'] = faces.map((vertexIds, i) => ({
		id: 'face' + i,
		vertexIds,
		neighbors: [],
		groundKind: i % 2 === 0 ? 'river' : 'dry'
	}));
	const builtVertices = [...vertices];
	const builtCells = landings.map((id) => {
		const [x, y] = points[id];
		for (const dy of [-1, 1])
			builtVertices.push({ id: id + '/' + dy, position: [x + Math.sign(x) * 20, y + dy, 0] });
		return { id: id + '/head', vertexIds: [id, id + '/-1', id + '/1'], neighbors: [] };
	});
	const sample: CityTerrainSampler = (x, y) => {
		const waterClearance = clearance(x, y);
		return waterClearance < 0
			? { height: 0, waterClearance, waterKind: 'river', waterHeight: 1 }
			: { height: 0, waterClearance, waterKind: null };
	};
	const built = { vertices: builtVertices, cells: builtCells, boundary: [] };
	return channelCrossings(
		{ vertices, cells, boundary: [] },
		built,
		sample,
		[0, 0],
		(kind) => kind === 'river'
	);
}

test('finds a longer continuous crossing when the shorter edge path leaves and reenters water', () => {
	const crossings = crossingProbe(
		{ a: [-50, 0], b: [50, 0], c: [0, 26], d: [0, -32] },
		[
			['a', 'c', 'b', 'd'],
			['d', 'b', 'c', 'a']
		],
		['a', 'b'],
		(x, y) => Math.max(Math.abs(x) - 15, Math.min(6 - Math.abs(x), y - 10))
	);
	expect(crossings.map(({ path }) => path.nodeIds)).toEqual([['a', 'd', 'b']]);
});

test('rejects intersecting bridge chords even with separated crossing midpoints', () => {
	const crossings = crossingProbe(
		{
			a: [-30, -130],
			b: [26, 130],
			c: [24, -101],
			d: [-30, 315],
			e: [40, 55],
			f: [-24, 190],
			k: [32, 150],
			g: [0, 20],
			h: [0, 40],
			i: [0, 160],
			j: [0, 140]
		},
		[
			['a', 'c', 'b', 'g'],
			['b', 'c', 'a', 'h'],
			['d', 'f', 'k', 'e', 'i'],
			['e', 'k', 'f', 'd', 'j']
		],
		['a', 'b', 'd', 'e'],
		(x) => Math.abs(x) - 25
	);
	expect(crossings.map(({ span }) => span?.nodeIds)).toEqual([['a', 'b']]);
});

test('ignores a wet spur that revisits a dry junction in favor of a longer simple crossing', () => {
	const crossings = crossingProbe(
		{
			a: [-20, 0],
			j: [-14, 12],
			w: [-11, 9],
			s: [-14, 10],
			k: [14, 12],
			b: [20, 0],
			d: [0, -25]
		},
		[
			['a', 'j', 'k', 'b', 'd'],
			['d', 'b', 'k', 'j', 'a'],
			['j', 'w', 's'],
			['s', 'w', 'j']
		],
		['a', 'b'],
		(x, y) => Math.max(Math.abs(x) - 12, y - 10)
	);
	expect(crossings.map(({ path }) => path.nodeIds)).toEqual([['a', 'd', 'b']]);
});
