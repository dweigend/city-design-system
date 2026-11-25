import { expect, test } from 'bun:test';
import { crossProduct, displacement, dotProduct, measurePolygon } from '../../core/geometry';
import { required } from '../../core/invariant';
import { encodePair } from '../../core/ref';
import { createCellSpace } from '../../domain/cell-space';
import {
	createCityLattice,
	latticeVariants,
	readLatticeBay,
	type CityLattice
} from '../../domain/city-volume';
import { createParcelPlan } from '../../domain/parcels';
import { dryPlanEdges, TerrainGrid } from '../../domain/terrain-grid';
import { cityPlanVariants } from '../city-site';
import { readFineCells, type BayFineCell } from './index';
import { fineCellsExample } from './example';

const recipe = { storeyHeightsM: [2, 3, 2] };

function assertClosed({ quad, faces }: BayFineCell) {
	expect(quad).toHaveLength(4);
	expect(measurePolygon(quad).area).toBeGreaterThan(0);
	expect(faces).toHaveLength(6);
	const edges = new Map<string, string[]>();
	for (const { corners } of faces) {
		expect(new Set(corners.map(({ id }) => id)).size).toBe(4);
		for (const [i, from] of corners.entries()) {
			const to = corners[(i + 1) % corners.length];
			const key = encodePair(from.id, to.id);
			edges.set(key, [...(edges.get(key) ?? []), from.id]);
		}
	}
	expect(edges.size).toBe(12);
	for (const ends of edges.values()) {
		expect(ends).toHaveLength(2);
		expect(ends[0]).not.toBe(ends[1]);
	}
}

function assertShared(first: readonly BayFineCell[], second: readonly BayFineCell[]) {
	const other = new Map(second.flatMap(({ faces }) => faces.map((face) => [face.id, face])));
	let shared = 0;
	for (const { faces } of first) {
		for (const face of faces) {
			const match = other.get(face.id);
			if (!match) continue;
			const start = match.corners.findIndex(({ id }) => id === face.corners[0].id);
			const n = match.corners.length;
			expect(face.corners).toEqual(face.corners.map((_, i) => match.corners[(start + n - i) % n]));
			shared++;
		}
	}
	return shared;
}

function fixture(variant: (typeof cityPlanVariants)[number]) {
	const grid = TerrainGrid.create({
		seed: 1201,
		variant,
		parameters: { cellSize: 30 },
		site: { origin: [0, 0], bearing: 0, width: 240, length: 240 },
		heightAt: () => 10
	});
	const first = required(
		grid.cells.find(({ neighbors }) => neighbors.every((id) => id !== null)),
		'interior cell'
	);
	const second = required(first.neighbors[0], 'neighbor');
	const pair = TerrainGrid.select(grid, [first.id, second]);
	const vertices = new Map(pair.vertices.map((vertex) => [vertex.id, vertex]));
	const columns = pair.cells.map(({ id, vertexIds, neighbors }) => ({
		planCellId: id,
		neighbors,
		corners: vertexIds.map((key) => required(vertices.get(key), 'column corner')),
		levels: 4
	}));
	const holdings = createParcelPlan({
		grid: pair,
		lanes: dryPlanEdges(pair, pair).map((edge) => ({
			edge,
			hierarchy: ['walkway'],
			widthM: 1,
			surface: 'walk'
		})),
		plannedKinds: Object.fromEntries(pair.cells.map(({ id }) => [id, 'private'])),
		holdingRules: { private: { minimumFrontageM: 1 } },
		tolerance: { linearToleranceM: 0.001, areaToleranceM2: 0.01, relativeAreaToleranceRatio: 0.001 }
	}).read();
	return { columns, holdings };
}

function assertFill(lattice: CityLattice, cell: BayFineCell) {
	const { floor, ceiling, solidTriangles } = readLatticeBay(lattice, cell.bayId);
	const points = cell.faces.flatMap(({ corners }) => corners.map(({ position }) => position));
	const enclosed = solidTriangles.some((faces) =>
		faces.every(([a, b, c]) => {
			const origin = a.position;
			const normal = crossProduct(
				displacement(origin, b.position),
				displacement(origin, c.position)
			);
			return points.every((point) => dotProduct(normal, displacement(origin, point)) <= 1e-7);
		})
	);
	expect(enclosed).toBe(true);
	expect(Math.min(...points.map((point) => point[2]))).toBeGreaterThanOrEqual(
		Math.max(...floor.map(({ position }) => position[2]))
	);
	expect(Math.max(...points.map((point) => point[2]))).toBeLessThanOrEqual(
		Math.min(...ceiling.map(({ position }) => position[2]))
	);
	const polygon = floor.map(({ position: [x, y] }) => [x, y] as const);
	for (const [x, y] of points) {
		for (const [[ax, ay], i] of polygon.map((point, i) => [point, i] as const)) {
			const [bx, by] = polygon[(i + 1) % polygon.length];
			expect((bx - ax) * (y - ay) - (by - ay) * (x - ax)).toBeGreaterThanOrEqual(-1e-9);
		}
	}
}

for (const plan of cityPlanVariants) {
	const { columns, holdings } = fixture(plan);
	for (const model of latticeVariants) {
		test(`${plan} × ${model} has conforming parcel quads and closed fine cells in shared bays`, () => {
			expect(holdings.parcels.length).toBeGreaterThan(0);
			for (const parcel of holdings.parcels) {
				const space = createCellSpace({ ...parcel, frontage: [], baseZ: 10, storeyCount: 1 }, 0);
				expect(space.cells.every(({ quad }) => quad.length === 4)).toBe(true);
				const area = space.cells.reduce((sum, { quad }) => sum + measurePolygon(quad).area, 0);
				expect(area).toBeCloseTo(measurePolygon(parcel.outline).area, 7);
			}
			const lattice = createCityLattice(columns, 10, model);
			const world = plan + '/study';
			const groups = lattice.cells.map(({ id }) => readFineCells(lattice, id, world, recipe));
			const cells = groups.flat();
			const [a, b] = columns.map(({ planCellId }) =>
				readFineCells(lattice, planCellId + '/level/0', world, recipe)
			);
			for (const [i, side] of [a, b].entries())
				expect(side).toHaveLength(columns[i].corners.length * 3);
			expect(assertShared(a, b)).toBe(6);
			expect(
				new Set(
					cells.flatMap(({ ref, storey }) => [JSON.stringify(ref), JSON.stringify(storey.ref)])
				).size
			).toBe(cells.length * 2);
			expect(new Set(a.map(({ storey }) => storey.heightM))).toEqual(new Set([2, 3]));
			for (const cell of cells) {
				assertClosed(cell);
				assertFill(lattice, cell);
			}
			expect(readFineCells(lattice, a[0].bayId, world, recipe)).toEqual(a);
			if (model === 'tree') expect(groups.some((group) => group.length === 0)).toBe(true);
		});
	}
}

test('the fixed section hook keeps storey keys when the recipe changes metric heights', () => {
	const { lattice, west, east } = fineCellsExample();
	expect(assertShared(west, east)).toBe(4);
	const lower = west.filter(({ storey }) => storey.datumIndex === 1);
	const upper = readFineCells(lattice, 'west/level/1', 'fine-example', { storeyHeightsM: [3, 4] });
	expect(assertShared(lower, upper)).toBe(4);
	const edited = readFineCells(lattice, west[0].bayId, 'fine-example', { storeyHeightsM: [4, 3] });
	expect(edited.map(({ ref }) => ref)).toEqual(west.map(({ ref }) => ref));
	expect(edited[0].storey.topZ).not.toBe(west[0].storey.topZ);
});
