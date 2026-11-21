import { beforeAll, expect, test } from 'bun:test';
import { boundaryRings, ringArea } from '../quad-grid';
import { createTerrain, valleyPoint } from '../terrain';
import { deriveGrid, regrid, type TerrainGrid } from '../terrain-grid';
import { deriveGroundPlan, type GroundPlan } from '.';

const ANCHOR = '76/64';
const SEEDS = [104, 207] as const;
type Cell = GroundPlan['cells'][number];
let grid: TerrainGrid;
let plans: GroundPlan[];

beforeAll(() => {
	grid = deriveGrid(createTerrain({ seed: 7 }));
	plans = SEEDS.map((seed) => deriveGroundPlan(grid, ANCHOR, seed));
});

const distance = (a: readonly number[], b: readonly number[]) =>
	Math.hypot(a[0] - b[0], a[1] - b[1]);

function overlap(a: readonly string[], b: readonly string[]) {
	const other = new Set(b);
	return a.filter((id) => other.has(id)).length / new Set([...a, ...b]).size;
}

function routeEdges(plan: GroundPlan) {
	const cells = new Map(plan.cells.map((cell) => [cell.id, cell]));
	return plan.routes.flatMap(({ cellIds }) =>
		cellIds.slice(1).map((id, i) => {
			const a = cells.get(cellIds[i]);
			const b = cells.get(id);
			if (!a || !b) throw Error('Route left the plan');
			return [a, b] as const;
		})
	);
}

function longestStraightRun(plan: GroundPlan) {
	const edges = routeEdges(plan).flatMap(
		([a, b]) =>
			[
				[a, b],
				[b, a]
			] as const
	);
	const links = new Map<string, Cell[]>();
	for (const [a, b] of edges) {
		const neighbors = links.get(a.id) ?? [];
		neighbors.push(b);
		links.set(a.id, neighbors);
	}
	const cosTolerance = Math.cos(Math.PI / 12);
	function length(a: Cell, b: Cell, dx: number, dy: number, seen: ReadonlySet<string>): number {
		const step = distance(a.center, b.center);
		const dot = (b.center[0] - a.center[0]) * dx + (b.center[1] - a.center[1]) * dy;
		if (dot < step * cosTolerance) return 0;
		const visited = new Set([...seen, a.id]);
		const onward = (links.get(b.id) ?? [])
			.filter((neighbor) => !visited.has(neighbor.id))
			.map((next) => length(b, next, dx, dy, visited));
		return step + Math.max(0, ...onward);
	}
	return Math.max(
		0,
		...edges.map(([a, b]) => {
			const step = distance(a.center, b.center);
			return length(
				a,
				b,
				(b.center[0] - a.center[0]) / step,
				(b.center[1] - a.center[1]) / step,
				new Set()
			);
		})
	);
}

function cellArea(cell: Cell) {
	return ringArea(cell.corners.map(([x, y]) => [x, y]));
}

test('repeats the same seed and preserves IDs across a distant terrain edit', () => {
	const [plan] = plans;
	expect(deriveGroundPlan(grid, ANCHOR, 104)).toEqual(plan);
	const farBank = valleyPoint(grid.terrain, 45, 220);
	const edited = regrid(
		grid,
		createTerrain({
			seed: 7,
			edits: [{ kind: 'basin', center: farBank, radius: 12 }]
		})
	);
	expect(edited).not.toBe(grid);
	expect(JSON.stringify(deriveGroundPlan(edited, ANCHOR, 104)) === JSON.stringify(plan)).toBe(true);
	for (const seed of [-1, 1.5, 2 ** 32, NaN])
		expect(() => deriveGroundPlan(grid, ANCHOR, seed)).toThrow(RangeError);
});

test('seeds move the outline, all three centres and the arterial across the same ground', () => {
	const [a, b] = plans;
	expect(
		overlap(
			a.cells.map(({ id }) => id),
			b.cells.map(({ id }) => id)
		)
	).toBeLessThan(0.7);
	expect(a.boundary).not.toEqual(b.boundary);
	for (const [i, centre] of a.centres.entries()) {
		const first = a.cells.find(({ id }) => id === centre.cellId);
		const second = b.cells.find(({ id }) => id === b.centres[i].cellId);
		if (!first || !second) throw Error('Missing centre');
		expect(distance(first.center, second.center)).toBeGreaterThan(35);
	}
	expect(overlap(a.routes[0].cellIds, b.routes[0].cellIds)).toBeLessThan(0.2);
});

test.each(SEEDS)(
	'seed %i has a connected hierarchy at bounded path share and straight run',
	(seed) => {
		const plan = plans[SEEDS.indexOf(seed)];
		const path = plan.areas.find(({ kind }) => kind === 'path');
		const plaza = plan.areas.find(({ kind }) => kind === 'plaza');
		if (!path || !plaza) throw Error('Missing circulation reserve');
		const paths = new Set(path.cellIds);
		const artery = plan.routes[0];
		const gate = plan.cells.find((cell) => cell.id === artery.cellIds.at(-1));
		expect(artery.cellIds[0]).toBe(
			plan.centres.find((centre) => centre.regime === 'detached')?.cellId ?? ''
		);
		expect(gate?.neighbors.some((n) => n !== null && plaza.cellIds.includes(n))).toBe(true);
		const reached = new Set(artery.cellIds);
		for (const route of plan.routes.slice(1)) {
			expect(reached.has(route.cellIds[0])).toBe(true);
			for (const id of route.cellIds.slice(1)) {
				expect(reached.has(id)).toBe(false);
				reached.add(id);
			}
		}
		expect(reached).toEqual(paths);
		expect(routeEdges(plan).every(([a, b]) => a.neighbors.includes(b.id))).toBe(true);
		expect(new Set(plan.routes.map(({ widthM }) => widthM)).size).toBe(3);
		const totalArea = plan.cells.reduce((sum, cell) => sum + cellArea(cell), 0);
		const pathArea = plan.cells
			.filter(({ id }) => paths.has(id))
			.reduce((sum, cell) => sum + cellArea(cell), 0);
		expect(pathArea / totalArea).toBeWithin(0.13, 0.24);
		expect(longestStraightRun(plan)).toBeLessThanOrEqual(32.001);
		expect(path).toMatchObject({ reserve: { kind: 'clearance', clearanceM: 3.7 } });
	}
);

test('the steeper contour lanes carry more routing per unit of ground than the flats', () => {
	const [plan] = plans;
	const path = new Set(plan.routes.flatMap(({ cellIds }) => cellIds));
	const pathShare = (pattern: Cell['pattern']) => {
		const land = plan.cells.filter((cell) => cell.pattern === pattern);
		return land.filter(({ id }) => path.has(id)).length / land.length;
	};
	expect(pathShare('contour')).toBeGreaterThan(2 * pathShare('orthogonal'));
	const span = (pattern: Cell['pattern']) => {
		const zs = plan.cells.filter((c) => c.pattern === pattern).map(({ center }) => center[2]);
		return Math.max(...zs) - Math.min(...zs);
	};
	expect(span('contour')).toBeGreaterThan(2 * span('orthogonal'));
});

test.each(SEEDS)(
	'seed %i allocates old-town enclosures, detached gaps and spaced centre towers',
	(seed) => {
		const plan = plans[SEEDS.indexOf(seed)];
		const cells = new Map(plan.cells.map((cell) => [cell.id, cell]));
		expect(plan.areas.flatMap(({ cellIds }) => cellIds).sort()).toEqual([...cells.keys()].sort());
		expect(new Set(plan.areas.map(({ id }) => id)).size).toBe(plan.areas.length);
		const courts = plan.areas.filter(({ kind }) => kind === 'court');
		expect(courts.length).toBeGreaterThanOrEqual(3);
		for (const { cellIds } of courts) {
			const cell = cells.get(cellIds[0]);
			expect(cell?.neighbors.map((n) => (n === null ? null : cells.get(n)?.plot?.kind))).toEqual(
				Array.from({ length: 4 }, () => 'perimeter')
			);
		}
		expect(
			courts.every((court) => 'reserve' in court && court.reserve.kind === 'open-to-sky')
		).toBe(true);
		const eaves = plan.cells.flatMap(({ plot }) =>
			plot?.kind === 'perimeter' ? [plot.eaveZ] : []
		);
		expect(new Set(eaves).size).toBe(1);
		expect(plan.cells.some(({ plot }) => plot?.kind === 'house')).toBe(true);
		expect(
			plan.areas.some(
				({ kind, cellIds }) => kind === 'gap' && cells.get(cellIds[0])?.regime === 'detached'
			)
		).toBe(true);
		const towers = plan.cells.filter(({ plot }) => plot?.kind === 'tower');
		expect(towers.length).toBeWithin(3, 6);
		expect(towers.every((tower) => tower.regime === 'dense-centre')).toBe(true);
		for (const [i, tower] of towers.entries())
			for (const other of towers.slice(i + 1))
				expect(distance(tower.center, other.center)).toBeGreaterThanOrEqual(15.5);
		const sourceCells = grid.cells.filter(({ id }) => cells.has(id));
		expect(boundaryRings(sourceCells, (id) => cells.has(id))).toEqual(plan.boundary);
	}
);
