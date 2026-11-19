// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
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
