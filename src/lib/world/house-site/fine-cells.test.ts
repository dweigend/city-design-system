import { expect, test } from 'bun:test';
import {
	crossProduct,
	displacement,
	dotProduct,
	measurePolygon,
	readVertexMean,
	type Vec3
} from '../../core/geometry';
import { required } from '../../core/invariant';
import { encodePair } from '../../core/ref';
import { createCellSpace } from '../../domain/cell-space';
import {
	createCityLattice,
	latticeVariants,
	readLatticeBay,
	type CityLattice,
	type StructuralColumn
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

type SolidTriangles = ReturnType<typeof readLatticeBay>['solidTriangles'];

function winding(faces: SolidTriangles[number], point: Vec3) {
	return faces.reduce((total, face) => {
		const [a, b, c] = face.map(({ position }) => displacement(point, position));
		const [u, v, w] = [Math.hypot(...a), Math.hypot(...b), Math.hypot(...c)];
		return (
			total +
			2 *
				Math.atan2(
					dotProduct(a, crossProduct(b, c)),
					u * v * w + dotProduct(a, b) * w + dotProduct(b, c) * u + dotProduct(c, a) * v
				)
		);
	}, 0);
}

function assertFill(lattice: CityLattice, solidTriangles: SolidTriangles, cell: BayFineCell) {
	const { floor, ceiling } = readLatticeBay(lattice, cell.bayId);
	const points = cell.faces.flatMap(({ corners }) => corners.map(({ position }) => position));
	const [x, y] = readVertexMean(cell.quad);
	const { bottomZ, topZ } = cell.storey;
	const sample: Vec3 = [x, y, bottomZ + 0.371 * (topZ - bottomZ)];
	expect(solidTriangles.reduce((sum, faces) => sum + winding(faces, sample), 0)).toBeCloseTo(
		4 * Math.PI,
		6
	);
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
			const triangles = lattice.cells.flatMap(
				({ id }) => readLatticeBay(lattice, id).solidTriangles
			);
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
				assertFill(lattice, triangles, cell);
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

function squareColumn(heights: readonly number[]): StructuralColumn {
	return {
		planCellId: 'square',
		neighbors: [null, null, null, null],
		levels: 1,
		corners: (
			[
				[0, 0],
				[10, 0],
				[10, 10],
				[0, 10]
			] as const
		).map(([x, y], i) => ({ id: 'abcd'[i], position: [x, y, heights[i]] }))
	};
}

test('keeps the downhill storey when a different corner of the bay rises above it', () => {
	const lattice = createCityLattice([squareColumn([0, 6, 6, 0])], 0);
	const cells = readFineCells(lattice, 'square/level/0', 'slope', { storeyHeightsM: [3, 4] });
	expect(cells.map(({ storey }) => [storey.cellId, storey.bottomZ, storey.topZ])).toEqual([
		['square/child/["a"]', 3, 7],
		['square/child/["d"]', 3, 7]
	]);
	expect(cells.map(({ ref }) => JSON.parse(ref.key) as unknown)).toEqual([
		['square', 'square/child/["a"]', 'd', 1],
		['square', 'square/child/["d"]', 'd', 1]
	]);
});

test('keeps fine cells above the high diagonal of a non-convex saddle foundation', () => {
	const lattice = createCityLattice([squareColumn([6, 0, 6, 0])], 0);
	const cells = readFineCells(lattice, 'square/level/0', 'saddle', { storeyHeightsM: [6, 1] });
	expect(cells).toHaveLength(4);
	expect(cells.every(({ storey }) => storey.bottomZ === 6 && storey.topZ === 7)).toBe(true);
});

test('fills interior upper bands across tetrahedra and pyramids assigned to other bays', () => {
	const columns = Array.from({ length: 9 }, (_, i): StructuralColumn => {
		const x = i % 3;
		const y = Math.floor(i / 3);
		return {
			planCellId: 'cell/' + i,
			neighbors: [
				i >= 3 ? 'cell/' + (i - 3) : null,
				x < 2 ? 'cell/' + (i + 1) : null,
				i < 6 ? 'cell/' + (i + 3) : null,
				x > 0 ? 'cell/' + (i - 1) : null
			],
			levels: 4,
			corners: [
				[x, y],
				[x + 1, y],
				[x + 1, y + 1],
				[x, y + 1]
			].map(([a, b]) => ({
				id: `${a},${b}`,
				position: [a * 10, b * 10, 0]
			}))
		};
	});
	for (const model of ['antiprism', 'diagrid'] as const) {
		const lattice = createCityLattice(columns, 0, model);
		for (const level of [2, 3]) {
			const id = `cell/4/level/${level}`;
			const bay = readLatticeBay(lattice, id);
			expect(bay.solids.some((solid) => solid.id === id + '/cell')).toBe(true);
			const cells = readFineCells(lattice, id, model, { storeyHeightsM: [3, 4] });
			expect(cells).toHaveLength(8);
			const ownedOnly = { ...lattice, solids: lattice.solids.filter(({ bay }) => bay === id) };
			expect(readFineCells(ownedOnly, id, model, { storeyHeightsM: [3, 4] }).length).toBeLessThan(
				cells.length
			);
			expect(
				cells.every(
					({ storey }) => storey.datumIndex === level * 2 || storey.datumIndex === level * 2 + 1
				)
			).toBe(true);
		}
	}
});
