import { expect, test } from 'bun:test';
import { distance, measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { cityPlanVariants } from '../../domain/city-volume';
import {
	planCellSide,
	planEdges,
	shorelineMorphLimits,
	TerrainGrid,
	type TerrainGridOptions
} from '../../domain/terrain-grid';
import { citySiteConfig, coarseCellSize, createCitySite } from './index';

const minimumEdge = coarseCellSize * shorelineMorphLimits.clippedMinimumEdgeRatio;
const minimumArea = coarseCellSize ** 2 * shorelineMorphLimits.clippedMinimumAreaRatio;

function layout(
	variant: (typeof cityPlanVariants)[number],
	seed: number,
	relief: number,
	runoff: number
) {
	const city = createCitySite(undefined, { seed, relief, runoff });
	const read = city.sampleGround;
	const clearanceAt = (x: number, y: number) =>
		read(x, y).waterClearance - citySiteConfig.bankSetbackM;
	const options: TerrainGridOptions = {
		seed,
		variant,
		site: { origin: [0, 0], bearing: -Math.PI / 2, length: 3200, width: 3600 },
		parameters: { cellSize: coarseCellSize / planCellSide[variant] },
		heightAt: (x, y) => read(x, y).height,
		maximumCellRise: 16,
		edgeSampleStep: citySiteConfig.groundSampleStepM,
		shore: { clearanceAt, minimumEdge, minimumArea }
	};
	const cover = ([x, y]: Vec2) => read(x, y).waterKind ?? 'dry';
	const before = TerrainGrid.createPlan(options, cover).plan;
	const after = TerrainGrid.createPlan(
		{ ...options, shore: { clearanceAt, minimumEdge, minimumArea, align: true } },
		cover
	).plan;
	return { before, after, clearanceAt };
}

function positions(grid: TerrainGrid) {
	return new Map(grid.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
}

function qualityOf(points: readonly Vec2[]) {
	let minAngle = Infinity;
	let minEdge = Infinity;
	let maxEdge = 0;
	for (const [[x, y], i] of points.map((p, i) => [p, i] as const)) {
		const [a, b] = points[(i + 1) % points.length];
		const [u, v] = points[(i + points.length - 1) % points.length];
		const angle = Math.atan2(
			(a - x) * (v - y) - (b - y) * (u - x),
			(a - x) * (u - x) + (b - y) * (v - y)
		);
		minAngle = Math.min(minAngle, angle);
		const edge = Math.hypot(a - x, b - y);
		minEdge = Math.min(minEdge, edge);
		maxEdge = Math.max(maxEdge, edge);
	}
	return { minAngle, edgeRatio: maxEdge / minEdge, area: measurePolygon(points).area };
}

for (const variant of cityPlanVariants) {
	test(`${variant} keeps topology and cell quality through lowland, tributary and lake morphs`, () => {
		let moved = 0;
		for (const [seed, relief, runoff] of [
			[1201, 0, 1],
			[42, 0, 1],
			[42, 0.75, 1.5],
			[42, 1, 0.5]
		] as const) {
			const { before, after, clearanceAt } = layout(variant, seed, relief, runoff);
			if (relief === 1) {
				const kinds = new Set(before.cells.map(({ groundKind }) => groundKind));
				expect(kinds.has('tributary') && kinds.has('lake')).toBe(true);
			}
			const topology = ({ cells, boundary }: TerrainGrid) => ({
				cells: cells.map(({ id, vertexIds, neighbors }) => [id, vertexIds, neighbors]),
				boundary
			});
			expect(topology(after)).toEqual(topology(before));
			const original = positions(before);
			const shifted = positions(after);
			for (const [id, point] of original) {
				const current = required(shifted.get(id), 'morphed node');
				if (Math.abs(clearanceAt(...point)) >= shorelineMorphLimits.bandM)
					expect(current).toEqual(point);
				const shiftM = distance(point, current);
				expect(shiftM).toBeLessThanOrEqual(shorelineMorphLimits.maximumMoveM + 1e-8);
				moved += Number(shiftM > 0.01);
			}
			for (const { vertexIds } of after.cells) {
				const base = qualityOf(
					vertexIds.map((id) => required(original.get(id), 'original corner'))
				);
				const next = qualityOf(vertexIds.map((id) => required(shifted.get(id), 'shifted corner')));
				expect(next.minAngle).toBeGreaterThanOrEqual(
					Math.min(base.minAngle, shorelineMorphLimits.minimumAngleRad) - 1e-8
				);
				expect(next.edgeRatio).toBeLessThanOrEqual(
					Math.max(base.edgeRatio, shorelineMorphLimits.maximumEdgeRatio) + 1e-8
				);
				expect(next.area / base.area).toBeGreaterThanOrEqual(
					shorelineMorphLimits.minimumAreaRatio - 1e-8
				);
				expect(next.area / base.area).toBeLessThanOrEqual(
					shorelineMorphLimits.maximumAreaRatio + 1e-8
				);
			}
		}
		expect(moved).toBeGreaterThan(0);
	}, 30_000);

	test(`${variant} aligns a chain of bank edges within the setback tolerance`, () => {
		const clearanceAt = (x: number, y: number) => Math.abs(x - 0.06 * y) - 70;
		const { plan } = TerrainGrid.createPlan(
			{
				seed: 1201,
				variant,
				site: { origin: [0, 0], bearing: -Math.PI / 2, length: 1250, width: 600 },
				parameters: { cellSize: coarseCellSize / planCellSide[variant] },
				heightAt: () => 0,
				edgeSampleStep: citySiteConfig.groundSampleStepM,
				shore: { clearanceAt, minimumEdge, minimumArea, align: true }
			},
			([x, y]) => (clearanceAt(x, y) < -citySiteConfig.bankSetbackM ? 'river' : 'dry')
		);
		const points = positions(plan);
		const cover = new Map(plan.cells.map(({ id, groundKind }) => [id, groundKind]));
		const aligned = new Map<string, number>();
		for (const {
			cellIds,
			nodeIds: [a, b]
		} of planEdges(plan)) {
			if (cellIds.length !== 2 || cover.get(cellIds[0]) === cover.get(cellIds[1])) continue;
			const [x, y] = required(points.get(a), 'bank node');
			const [u, v] = required(points.get(b), 'bank node');
			if (
				[clearanceAt(x, y), clearanceAt((x + u) / 2, (y + v) / 2), clearanceAt(u, v)].some(
					(d) => Math.abs(d) > shorelineMorphLimits.bankToleranceM
				)
			)
				continue;
			aligned.set(a, (aligned.get(a) ?? 0) + 1);
			aligned.set(b, (aligned.get(b) ?? 0) + 1);
		}
		expect([...aligned.values()].filter((degree) => degree === 2).length).toBeGreaterThan(2);
	});
}

test('keeps the original carrier for an isolated channel narrower than the snap threshold', () => {
	const clearanceAt = (x: number, y: number) =>
		Math.abs(x - 0.06 * y) - shorelineMorphLimits.minimumWaterWidthM / 4;
	const options: TerrainGridOptions = {
		seed: 1201,
		variant: 'organic',
		site: { origin: [0, 0], bearing: -Math.PI / 2, length: 1000, width: 600 },
		parameters: { cellSize: 60 / planCellSide.organic },
		heightAt: () => 0,
		shore: { clearanceAt, minimumEdge, minimumArea }
	};
	const cover = ([x, y]: Vec2) =>
		clearanceAt(x, y) < -citySiteConfig.bankSetbackM ? ('river' as const) : ('dry' as const);
	const base = TerrainGrid.createPlan(options, cover);
	const morphed = TerrainGrid.createPlan(
		{
			...options,
			shore: { clearanceAt, minimumEdge, minimumArea, align: true }
		},
		cover
	);
	expect(morphed).toEqual(base);
});
