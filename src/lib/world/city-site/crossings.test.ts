import { expect, test } from 'bun:test';
import { distance, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { crossingLimits, planEdgeGraph, TerrainGrid } from '../../domain/terrain-grid';
import { channelCrossings } from './crossings';
import { createCitySite, readCityGrid, type CityTerrainSampler } from './index';

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
			if (chordM / path.lengthM < crossingLimits.straightSpanThresholdRatio)
				expect(span).toEqual({ nodeIds: endpoints, lengthM: chordM });
			else expect(span).toBeUndefined();
			let wet = false;
			for (const { from, to } of path.edges) {
				const [[x, y], [u, v]] = [graph.point(from), graph.point(to)];
				const count = Math.ceil(Math.hypot(u - x, v - y) / crossingLimits.channelSampleStepM);
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

test('equal scores select the same crossings if built polygons are reversed', () => {
	const clearanceAt = (x: number, y: number) => Math.abs(Math.hypot(x, y) - 130) - 48;
	const sample: CityTerrainSampler = (x, y) => {
		const waterClearance = clearanceAt(x, y);
		const dry = waterClearance >= 0;
		return { height: 0, waterClearance, dry, waterKind: dry ? null : 'river' };
	};
	const { grid, plan } = TerrainGrid.createPlan(
		{
			seed: 1201,
			variant: 'square',
			parameters: { cellSize: 60 },
			site: { origin: [0, 0], bearing: 0, length: 720, width: 720 },
			heightAt: () => 0,
			shore: { clearanceAt, minimumEdge: 2, minimumArea: 200 }
		},
		([x, y]) => (sample(x, y).dry ? 'dry' : 'river')
	);
	const core: Vec2 = [0, 30];
	const ranked = channelCrossings(plan, grid, sample, core);
	expect(ranked.length).toBeGreaterThan(0);
	const reversed = { ...grid, cells: [...grid.cells].reverse() };
	expect(channelCrossings(plan, reversed, sample, core)).toEqual(ranked);
});
