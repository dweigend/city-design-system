import { expect, test } from 'bun:test';
import { cityCentreView, cityCorridorSite, openingScene } from '../../logic/sandbox';
import { required } from '../../logic/required';
import { bankHeight, cellAtPoint, type TerrainGrid } from '../../logic/terrain-grid';
import type { Vec3 } from '../../logic/parametrik/types';
import { poolWaterTriangles } from './pool-water';

const key = (p: Vec3) =>
	p
		.slice(0, 2)
		.map((v) => Math.round(v * 1e5))
		.join(',');
function components(triangles: Vec3[][]) {
	const parents = triangles.map((_, i) => i),
		edges = new Map<string, number>();
	const root = (i: number): number => (parents[i] === i ? i : (parents[i] = root(parents[i])));
	for (const [i, face] of triangles.entries())
		for (const [j, p] of face.entries()) {
			const edge = [key(p), key(face[(j + 1) % 3])].sort().join('|'),
				prior = edges.get(edge);
			if (prior !== undefined) parents[root(i)] = root(prior);
			edges.set(edge, i);
		}
	return new Set(parents.map(root)).size;
}

function surveyedPools(grid: TerrainGrid) {
	const pools = new Map<number, Vec3[][]>();
	for (const cell of grid.cells) {
		const water = poolWaterTriangles(cell);
		for (let i = 0; i < water.length; i += 3) {
			const face = water.slice(i, i + 3),
				[a, b, c] = face;
			if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-9) continue;
			expect(a[2]).toBe(b[2]);
			expect(a[2]).toBe(c[2]);
			const ground = bankHeight(cell, (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3);
			expect(ground).toBeLessThanOrEqual(a[2] + 1e-7);
			const basin = pools.get(a[2]) ?? [];
			basin.push(face);
			pools.set(a[2], basin);
		}
	}
	return pools;
}

for (const seed of [7, 13, 29])
	test(
		'the court basins hold connected water below the public crossings on seed ' + seed,
		() => {
			const { world } = openingScene(seed),
				grid = world.grid;
			const pools = surveyedPools(grid);
			const city = required(world.state.city, 'court plan');
			expect(pools.size).toBe(city.centres.filter((c) => c.ensembles.length >= 2).length);
			for (const pool of pools.values()) expect(components(pool)).toBe(1);
			const [paths, station] = required(cityCorridorSite(world), 'public crossings');
			const crossed = new Set<number>();
			for (const path of paths)
				for (const [i, id] of path.slice(1).entries()) {
					const a = station(path[i]),
						b = station(id);
					for (let k = 0; k <= 8; k++) {
						const x = a[0] + ((b[0] - a[0]) * k) / 8,
							y = a[1] + ((b[1] - a[1]) * k) / 8;
						const cell = cellAtPoint(grid, x, y),
							level = cell?.bank?.water;
						if (!cell || level === undefined || bankHeight(cell, x, y) >= level) continue;
						expect(a[2] + ((b[2] - a[2]) * k) / 8).toBeGreaterThan(level);
						crossed.add(level);
					}
				}
			expect(crossed.size).toBe(pools.size);
		},
		60000
	);

test('the lawn and its stone rim have one rounded seam flush with the court', () => {
	const { world } = openingScene(7),
		parts = cityCentreView(world);
	const lawns = parts.filter((p) => p.id.startsWith('court-lawn/'));
	expect(lawns).toHaveLength(world.state.city?.centres.flatMap((c) => c.ensembles).length ?? 0);
	for (const lawn of lawns) {
		const rim = parts.find((p) => p.id === 'court/' + lawn.id.slice('court-lawn/'.length));
		if (lawn.kind !== 'prism' || rim?.kind !== 'prism') throw Error('Missing lawn or rim');
		expect(lawn.polygon.length).toBeGreaterThan(16);
		expect(rim.holes).toEqual([lawn.polygon]);
		expect(lawn.z + lawn.height).toBeCloseTo(rim.z + rim.height, 9);
	}
}, 60000);
