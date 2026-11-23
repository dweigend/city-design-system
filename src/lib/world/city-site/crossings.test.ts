import { expect, test } from 'bun:test';
import { distance, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { dryPlanEdges, planEdgeGraph, TerrainGrid } from '../../domain/terrain-grid';
import { createMainLaneRouter } from './main-lanes';
import { channelCrossings } from './crossings';
import { citySiteConfig, createCitySite, readCityGrid, type CityTerrainSampler } from './index';

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
	const ranked = channelCrossings(plan, grid, sample, core);
	expect(ranked.length).toBeGreaterThan(0);
	const reversed = { ...grid, cells: [...grid.cells].reverse() };
	expect(channelCrossings(plan, reversed, sample, core)).toEqual(ranked);
});

test('routes from a real crossing head over addressed clipped bank intervals', () => {
	const { grid, plan, sample } = clippedBank();
	const crossing = required(channelCrossings(plan, grid, sample, [0, 30])[0], 'crossing');
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
