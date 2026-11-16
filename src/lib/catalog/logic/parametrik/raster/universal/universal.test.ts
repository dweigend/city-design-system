// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { gridGenerators } from '../index';
import { area, cross } from '../geometry';
import {
	toPatch,
	strukturen,
	organicGrid,
	affectedRegion,
	encodeState,
	decodeState
} from './index';
const generators = [...gridGenerators, { kind: 'organic', generate: organicGrid }];
for (const generator of generators)
	test(`${generator.kind}: convex manifold quads, deterministic structures`, () => {
		for (const seed of [0, 42, 317]) {
			const grid = generator.generate({}, seed),
				before = JSON.stringify(grid);
			const patch = toPatch(grid, { seed, cellSize: 5 });
			expect(patch).toEqual(toPatch(grid, { seed, cellSize: 5 }));
			expect(JSON.stringify(grid)).toBe(before);
			const vertices = new Map(patch.vertices.map((v) => [v.id, v]));
			const edges = new Map<string, number>();
			for (const f of patch.faces) {
				const p = f.vertices.map((id) => vertices.get(id)!.point);
				expect(area(p)).toBeGreaterThan(0);
				p.forEach((a, i) => expect(cross(a, p[(i + 1) % 4], p[(i + 2) % 4])).toBeGreaterThan(0));
				f.vertices.forEach((a, i) => {
					const k = [a, f.vertices[(i + 1) % 4]].sort().join('|');
					edges.set(k, (edges.get(k) ?? 0) + 1);
				});
				for (const n of f.neighbors)
					if (n) expect(patch.faces.find((g) => g.id === n)!.neighbors).toContain(f.id);
			}
			for (const count of edges.values()) expect(count).toBeLessThanOrEqual(2);
			for (const v of patch.vertices)
				for (const n of v.neighbors) {
					expect(vertices.get(n)!.neighbors).toContain(v.id);
					expect(patch.origins.get(n)!.level).toBe(patch.origins.get(v.id)!.level);
				}
			const s = strukturen(patch);
			expect(s.blocks.length).toBeGreaterThan(0);
			expect(s.parcels.length).toBeGreaterThan(0);
			expect(s.fields.size).toBe(patch.vertices.length);
			expect(s).toEqual(strukturen(patch));
			for (const block of s.blocks) {
				const visited = new Set([block.cells[0]]),
					queue = [block.cells[0]];
				for (let i = 0; i < queue.length; i++)
					for (const n of vertices.get(queue[i])!.neighbors)
						if (s.blockOf.get(n) === block && !visited.has(n)) {
							visited.add(n);
							queue.push(n);
						}
				expect(visited.size).toBe(block.cells.length);
			}
			expect(decodeState(encodeState(patch, s))).toEqual({ patch, structures: s });
		}
	});
test('holes, fixed cells, stable IDs and local dependency halo', () => {
	const g = gridGenerators[0].generate({ count: 5 }, 42);
	g.cells = g.cells.filter((c) => c.id !== '2-2-0');
	const a = toPatch(g, { iterations: 0 }),
		b = toPatch(g, { fixedCells: new Set(g.cells.map((c) => c.id)) });
	expect(b.vertices.map((v) => v.point)).toEqual(a.vertices.map((v) => v.point));
	expect(b.vertices.filter((v) => v.boundary).length).toBeGreaterThan(40);
	expect(affectedRegion(a, [a.vertices[0].id], 0).size).toBe(1);
	expect(affectedRegion(a, [a.vertices[0].id], 2).size).toBeGreaterThan(1);
	const moved = {
		...g,
		cells: g.cells.map((c) => ({
			...c,
			polygon: c.polygon.map(([x, y]) => [x + 2, y + 1] as [number, number])
		}))
	};
	expect(toPatch(moved).vertices.map((v) => v.id)).toEqual(a.vertices.map((v) => v.id));
});

test('local coordinate transaction preserves IDs, unrelated points and rejects folds', async () => {
	const { updatePatch } = await import('./index');
	const patch = toPatch(gridGenerators[0].generate({}, 42));
	const v = patch.vertices.find((v) => !v.boundary)!;
	const moved = updatePatch(patch, new Map([[v.id, [v.point[0] + 0.1, v.point[1]]]]));
	expect(moved.vertices.map((v) => v.id)).toEqual(patch.vertices.map((v) => v.id));
	expect(moved.vertices.filter((w) => w.id !== v.id).map((w) => w.point)).toEqual(
		patch.vertices.filter((w) => w.id !== v.id).map((w) => w.point)
	);
	expect(() => updatePatch(patch, new Map([[v.id, [10000, 10000]]]))).toThrow();
	const boundary = patch.vertices.find((v) => v.boundary)!;
	expect(() => updatePatch(patch, new Map([[boundary.id, [0, 0]]]))).toThrow();
});
