// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { createTerrain } from '../terrain';
import { deriveGrid } from './index';
import { kern } from '../parametrik/raster/universal';
import { defaultAlleyPlan } from './alley-profile';
import { blockTemplate } from './block-faces';
import { get, sourceGraph } from './block-graph';
import { hash } from '../hash-random';

for (const seed of [7, 8, 9])
	test(
		'seed ' +
			seed +
			' block 2/2 uses the actual OBB cut, preserves its two fronts and keeps the cut straight after relaxation',
		() => {
			const graph = sourceGraph(12, 8, seed, defaultAlleyPlan, true, false);
			const built = blockTemplate(12, 8, seed, defaultAlleyPlan, true, false);
			const block = graph.faces.get('2/2');
			if (!block) throw new Error('missing court');
			const ring = block.ring.map((id) => get(graph.positions, id));
			const fronts = ring.map((a, i) => ({
				id: block.ring[i],
				a,
				b: ring[(i + 1) % 4],
				width: defaultAlleyPlan.alleyWidth,
				level: 0,
				kind: 'alley' as const
			}));
			const options = {
				firstCut: kern.cutRatios[Math.floor(hash(seed, 2, 2) * 3)],
				level: 0,
				minArea: 15,
				maxArea: kern.area(ring) - 15,
				minWidth: 1.8,
				minFront: 1.8,
				maxDepth: 1
			};
			expect(() => kern.parcelize(block.id, ring, [], options)).toThrow('landlocked');
			const split = kern.parcelize(block.id, ring, fronts, options);
			expect(split.unresolved).toEqual([]);
			expect(split.leaves.length).toBe(2);
			const vertices = (id: string) => get(built.positions, id);
			for (const leaf of split.leaves) {
				const members = [...built.faces.values()].filter(
					(f) => built.parents.get(f.id)?.parcel === leaf.id
				);
				expect(members.length).toBe(2);
				const polys = members.map((f) => f.ring.map(vertices));
				expect(polys.reduce((sum, p) => sum + kern.area(p), 0)).toBeCloseTo(
					kern.area(leaf.polygon),
					10
				);
				expect(leaf.access.some((a) => a.length >= options.minFront)).toBe(true);
				for (const p of leaf.polygon)
					expect(polys.flat().some((v) => kern.length(kern.sub(v, p)) < 1e-10)).toBe(true);
			}
			const common = split.leaves[0].polygon.filter((p) =>
				split.leaves[1].polygon.some((v) => kern.length(kern.sub(v, p)) < 1e-10)
			);
			expect(common.length).toBe(2);
			const center = vertices('3/3');
			expect(kern.length(kern.sub(center, kern.mix(common[0], common[1], 0.5)))).toBeLessThan(
				1e-10
			);
		}
	);

for (const [seed, block, middle] of [
	[7, '72:88/2/2', '75/91'],
	[38, '84:80/8/4', '93/85']
] as const)
	test('projected court seams are straight in seed ' + seed, () => {
		const grid = deriveGrid(createTerrain({ seed }));
		const courts = new Map<string, (typeof grid.cells)[number][]>();
		for (const cell of grid.cells) {
			if (!cell.parcelAccess || cell.parcel === cell.block) continue;
			expect(cell.parcelAccess).toBe('fronted');
			const members = courts.get(cell.block) ?? [];
			members.push(cell);
			courts.set(cell.block, members);
		}
		expect(courts.size).toBeGreaterThan(0);
		expect(courts.has(block)).toBe(seed === 7);
		for (const [id, members] of courts) {
			const shared = new Map<string, Set<string>>();
			for (const cell of members)
				for (const [side, neighbor] of cell.neighbors.entries()) {
					if (!members.some((other) => other.id === neighbor && other.parcel !== cell.parcel))
						continue;
					const a = cell.vertexIds[side],
						b = cell.vertexIds[(side + 1) % 4];
					const links = shared.get(a) ?? new Set();
					links.add(b);
					shared.set(a, links);
				}
			const center = [...shared].find(([, links]) => links.size === 2);
			if (!center) throw new Error('missing seam in ' + id);
			if (id === block) expect(center[0]).toBe(middle);
			const point = (key: string) => {
				const [c, r] = key.split('/').map(Number);
				return grid.vertices[r * (grid.columns + 1) + c];
			};
			const [a, b] = [...center[1]].map(point),
				m = point(center[0]);
			const u = [m[0] - a[0], m[1] - a[1]],
				v = [b[0] - m[0], b[1] - m[1]];
			const turn = Math.atan2(Math.abs(u[0] * v[1] - u[1] * v[0]), u[0] * v[0] + u[1] * v[1]);
			expect(turn).toBeLessThan(1e-9);
		}
	});

test('seed 7 rejects a cut with one inaccessible child and retains genuinely landlocked courts', () => {
	const grid = deriveGrid(createTerrain({ seed: 7 }));
	for (const id of ['68/20', '69/20', '68/21', '69/21'])
		expect(grid.cellsById.get(id)).toMatchObject({
			parcel: '60:16/8/4',
			parcelAccess: 'fronted',
			buildable: true
		});
	for (const id of ['90/18', '90/19', '91/18', '91/19'])
		expect(grid.cellsById.get(id)).toMatchObject({
			parcel: '84:16/6/2',
			parcelAccess: 'landlocked',
			buildable: false
		});
});
