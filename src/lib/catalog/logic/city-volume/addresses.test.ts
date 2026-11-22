import { beforeAll, expect, test } from 'bun:test';
import type { CellPoint } from '../cell-space';
import { deriveGroundPlan, type GroundPlan, type GroundPlanCell } from '../city-plan';
import { required } from '../required';
import { createTerrain } from '../terrain';
import { deriveGrid, type TerrainGrid } from '../terrain-grid';
import { deriveCityVolume } from '.';

let grid: TerrainGrid;
beforeAll(() => {
	grid = deriveGrid(createTerrain({ seed: 7 }));
}, 15000);
for (const seed of [104, 207]) {
	test(
		'seed ' + seed + ' survives reordered plan input',
		() => {
			const plan = deriveGroundPlan(grid, '76/64', seed);
			const first = deriveCityVolume(plan);
			const redraw = deriveGroundPlan(grid, '76/64', seed);
			const second = deriveCityVolume({
				...redraw,
				cells: [...redraw.cells].reverse(),
				areas: [...redraw.areas].reverse(),
				centres: [...redraw.centres].reverse()
			});
			expect(second).toEqual(first);
		},
		20000
	);
}

function mapQuad<T, U>([a, b, c, d]: readonly [T, T, T, T], project: (v: T) => U): [U, U, U, U] {
	return [project(a), project(b), project(c), project(d)];
}

function planarCrop() {
	const plan = deriveGroundPlan(grid, '76/64', 104);
	const byId = new Map(plan.cells.map((c) => [c.id, c]));
	const first = required(byId.get(plan.anchorId), 'anchor');
	const neighbor = (cell: GroundPlanCell, except?: string) =>
		required(
			byId.get(
				required(
					cell.neighbors.find((id) => id !== null && id !== except),
					'next cell'
				)
			),
			'neighbour'
		);
	const second = neighbor(first),
		third = neighbor(second, first.id);
	const pair = [first.id, second.id] as const;
	function crop(cells: GroundPlanCell[], shift: number): GroundPlan {
		const ids = new Set(cells.map((c) => c.id));
		function point([x, y]: CellPoint): CellPoint {
			return [x + shift * y, y, 0.1 * x + 0.2 * y];
		}
		const cellAt = (cell: GroundPlanCell): GroundPlanCell => ({
			...cell,
			center: point(cell.center),
			corners: mapQuad(cell.corners, point),
			neighbors: mapQuad(cell.neighbors, (id) => (id && ids.has(id) ? id : null))
		});
		return {
			...plan,
			cells: cells.map(cellAt),
			centres: plan.centres.map((c) => ({
				...c,
				cellId: c.regime === 'detached' ? second.id : first.id
			})),
			areas: plan.areas.map((area) => ({
				...area,
				cellIds: area.cellIds.filter((id) => ids.has(id))
			})),
			reservations: new Map([...plan.reservations].filter(([id]) => ids.has(id)))
		};
	}
	return { pair, small: crop([first, second], 0), extended: crop([first, second, third], 0.08) };
}

test('planar skew quads retain parent, corner, seam and pick addresses on deformation and extension', () => {
	const { pair, small, extended } = planarCrop();
	const options = { refineGroundPair: pair, lowHeightM: 10, denseHeightM: 10 };
	const before = deriveCityVolume(small, options);
	const after = deriveCityVolume(extended, options);
	expect(before.coarse.cells).toHaveLength(4);
	expect(before.leaves.cells).toHaveLength(18);
	expect(after.coarse.cells).toHaveLength(6);
	const bindings = new Map(after.bindings.map((b) => [b.leafId, b]));
	for (const b of before.bindings) expect(bindings.get(b.leafId)).toEqual(b);
	const faces = new Map(after.leaves.faces.map((f) => [f.id, f]));
	const nodes = new Map(after.leaves.nodes.map((n) => [n.id, n.position]));
	for (const n of before.leaves.nodes) expect(nodes.get(n.id)).toBeDefined();
	expect(nodes.get(before.leaves.nodes[0].id)).not.toEqual(before.leaves.nodes[0].position);
	for (const f of before.leaves.faces) {
		const retained = required(faces.get(f.id), 'surviving patch');
		expect(new Set(retained.nodeIds)).toEqual(new Set(f.nodeIds));
	}
	expect(
		before.leaves.faces.some((f) => f.uses.length === 1 && faces.get(f.id)?.uses.length === 2)
	).toBe(true);
});

test('invalid heights and nonadjacent refinement pairs fail before emitting a snapshot', () => {
	const { small, pair } = planarCrop();
	expect(() => deriveCityVolume(small, { denseHeightM: 33 })).toThrow(RangeError);
	expect(() => deriveCityVolume(small, { lowHeightM: 3 })).toThrow(RangeError);
	expect(() => deriveCityVolume(small, { refineGroundPair: [pair[0], pair[0]] })).toThrow(
		RangeError
	);
});
