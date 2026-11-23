import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import type { Vec2, Vec3 } from '../../core/geometry';
import { TerrainGrid, planVariants, terrainGridQuality, type TerrainGridOptions } from './index';
import { example } from './example';

const qualitySeeds = [0, 1, 7, 42, 1201, 1301, 1409, 65537, 4294967295];

const options: TerrainGridOptions = {
	seed: 1201,
	site: { origin: [12, 16], bearing: 0.31, length: 96, width: 64 },
	parameters: { cellSize: 5 },
	heightAt: (x, y) => 11 + 0.026 * x + 0.058 * y
};

function grow(length: number, width: number) {
	return TerrainGrid.create({ ...options, site: { ...options.site, length, width } });
}

test('repeats a detached frozen grid without coupling interleaved calls', () => {
	const source = { ...options, parameters: { cellSize: 10 } };
	const before = JSON.stringify(source);
	const grid = TerrainGrid.create(source);
	const same = TerrainGrid.create({ ...source });
	TerrainGrid.create({ ...source, seed: 99, parameters: { cellSize: 5 } });
	expect(TerrainGrid.create(source)).toEqual(grid);
	expect(same).toEqual(grid);
	expect(same.vertices[0]).not.toBe(grid.vertices[0]);
	expect(JSON.stringify(source)).toBe(before);
	expect(Object.isFrozen(grid.cells[0].neighbors)).toBe(true);
	expect(Object.isFrozen(grid.vertices[0].position)).toBe(true);
	expect(Object.isFrozen(grid.boundary[0])).toBe(true);
	expect(example().cells.length).toBeGreaterThan(30);
});

test('retains every position and existing neighbor through crop growth', () => {
	const small = grow(96, 64);
	const large = grow(161, 113);
	const vertices = new Map(large.vertices.map(({ id, position }) => [id, position]));
	const cells = new Map(large.cells.map((cell) => [cell.id, cell]));
	let newNeighbors = 0;
	let oldNeighbors = 0;
	expect(small.cells.length).toBeGreaterThan(100);
	expect(large.cells.length).toBeGreaterThan(small.cells.length);
	for (const { id, position } of small.vertices) expect(vertices.get(id)).toEqual(position);
	for (const { id, vertexIds, neighbors } of small.cells) {
		const cell = required(cells.get(id), 'retained cell');
		expect(cell.vertexIds).toEqual(vertexIds);
		neighbors.forEach((neighbor, i) => {
			if (neighbor !== null) {
				expect(cell.neighbors[i]).toEqual(neighbor);
				oldNeighbors++;
			} else if (cell.neighbors[i] !== null) newNeighbors++;
		});
	}
	expect(newNeighbors).toBeGreaterThan(0);
	expect(oldNeighbors).toBeGreaterThan(100);
});

test('rejects invalid inputs before consulting the sampler', () => {
	let calls = 0;
	const source = { ...options, heightAt: () => ++calls };
	for (const invalid of [
		{ ...source, seed: -1 },
		{ ...source, site: { ...options.site, bearing: Infinity } },
		{ ...source, site: { ...options.site, width: 0 } },
		{ ...source, parameters: { cellSize: NaN } }
	])
		expect(() => TerrainGrid.create(invalid)).toThrow(RangeError);
	expect(calls).toBe(0);
	expect(() => TerrainGrid.create({ ...options, heightAt: () => NaN })).toThrow(RangeError);
});

test('aligns the longer carrier axis to an oblique contour', () => {
	const grid = TerrainGrid.create(options);
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	const a = required(vertices.get('base/0,0'), 'datum vertex');
	const b = required(vertices.get('base/2,0'), 'contour vertex');
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	expect(Math.abs(b[2] - a[2]) / length).toBeLessThan(0.009);
	for (const {
		position: [x, y, z]
	} of grid.vertices)
		expect(z).toBe(required(options.heightAt(x, y), 'ground height'));
});

test('leaves out cells crossing a steep riser even when the full edge grade is low', () => {
	const site = { origin: [0, 0] as const, bearing: 0, length: 100, width: 72 };
	const heightAt = (_x: number, y: number) => (y >= 12 ? 0.65 : 0);
	const flat = TerrainGrid.create({
		seed: 42,
		site,
		parameters: { cellSize: 5 },
		heightAt: () => 0
	});
	const step = TerrainGrid.create({ seed: 42, site, parameters: { cellSize: 5 }, heightAt });
	const vertices = new Map(step.vertices.map(({ id, position }) => [id, position]));
	expect(step.cells.length).toBeLessThan(flat.cells.length);
	let lower = 0;
	let upper = 0;
	for (const { vertexIds } of step.cells) {
		const points = vertexIds.map((id) => required(vertices.get(id), 'incident vertex'));
		const levels = points.map((point) => point[2]);
		expect(levels.every((z) => z === levels[0])).toBe(true);
		if (levels[0] === 0) lower++;
		else upper++;
	}
	expect(lower).toBeGreaterThan(50);
	expect(upper).toBeGreaterThan(50);
});

function polygonMeasure(points: readonly Vec3[]) {
	const lengths: number[] = [];
	const angles: number[] = [];
	for (const [index, a] of points.entries()) {
		const b = points[(index + 1) % 4];
		const c = points[(index + 3) % 4];
		const u = [b[0] - a[0], b[1] - a[1]];
		const v = [c[0] - a[0], c[1] - a[1]];
		lengths.push(Math.hypot(...u));
		angles.push(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]));
	}
	return { angle: Math.min(...angles), ratio: Math.max(...lengths) / Math.min(...lengths) };
}

function separates(a: readonly Vec3[], b: readonly Vec3[]) {
	return a.some((point, i) => {
		const next = a[(i + 1) % 4];
		const dx = next[0] - point[0];
		const dy = next[1] - point[1];
		return b.every(([x, y]) => dx * (y - point[1]) - dy * (x - point[0]) <= 1e-9);
	});
}

test('registers shared sides exactly once and verifies quad quality and disjoint interiors', () => {
	for (const seed of qualitySeeds) {
		const grid = TerrainGrid.create({ ...options, seed });
		const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
		const boundary = new Set(grid.boundary.map(([a, b]) => [a, b].sort().join('\n')));
		const incidences = new Map<string, { cell: string; neighbor: string | null; from: string }[]>();
		const polygons = grid.cells.map(({ id, vertexIds, neighbors }) => {
			vertexIds.forEach((from, side) => {
				const key = [from, vertexIds[(side + 1) % 4]].sort().join('\n');
				const uses = incidences.get(key) ?? [];
				uses.push({ cell: id, neighbor: neighbors[side], from });
				incidences.set(key, uses);
			});
			return vertexIds.map((id) => required(vertices.get(id), 'incident vertex'));
		});
		expect(polygons.length).toBeGreaterThan(100);
		for (const [key, sides] of incidences) {
			expect(sides).toHaveLength(boundary.has(key) ? 1 : 2);
			expect(sides[0].neighbor).toBe(sides[1]?.cell ?? null);
			if (sides[1]) {
				expect(sides[1].neighbor).toBe(sides[0].cell);
				expect(sides[1].from).not.toBe(sides[0].from);
			}
		}
		checkPolygons(polygons, seed);
	}
});

function checkPolygons(polygons: readonly Vec3[][], seed: number) {
	for (const [i, a] of polygons.entries()) {
		const { angle, ratio } = polygonMeasure(a);
		expect(angle).toBeGreaterThanOrEqual(terrainGridQuality.minimumAngle);
		expect(ratio).toBeLessThanOrEqual(terrainGridQuality.maximumEdgeRatio);
		for (let j = i + 1; j < polygons.length; j++) {
			const b = polygons[j];
			if (!separates(a, b) && !separates(b, a))
				throw Error(`Overlapping cells for seed ${seed}: ${i} and ${j}`);
		}
	}
}

test('clips wholly to a simple concave outline and preserves identities as it grows', () => {
	const outline: readonly Vec2[] = [
		[-50, -50],
		[50, -50],
		[50, 50],
		[15, 50],
		[15, 7],
		[10, 7],
		[10, 50],
		[-50, 50]
	];
	const expanded: readonly Vec2[] = [
		[-80, -65],
		[80, -65],
		[80, 70],
		[15, 70],
		[15, 7],
		[10, 7],
		[10, 70],
		[-80, 70]
	];
	const polygon = (outline: readonly Vec2[]) =>
		TerrainGrid.create({
			...options,
			site: { origin: [0, 0], bearing: 0, outline },
			heightAt: () => 0
		});
	const small = polygon(outline);
	const large = polygon(expanded);
	expect(polygon([...outline].reverse())).toEqual(small);
	const larger = new Map(large.cells.map((cell) => [cell.id, cell]));
	for (const cell of small.cells) expect(larger.get(cell.id)?.vertexIds).toEqual(cell.vertexIds);
	const vertices = new Map(small.vertices.map((vertex) => [vertex.id, vertex.position]));
	// The vertical notch must not cut a retained cell, even when all its corners are outside it.
	for (const cell of small.cells) {
		const points = cell.vertexIds.map((id) => required(vertices.get(id), 'vertex'));
		for (const y of [8, 20, 35, 49]) {
			const point: Vec3 = [12.5, y, 0];
			expect(separates(points, [point])).toBe(true);
		}
	}
	expect(() =>
		TerrainGrid.create({
			...options,
			site: {
				origin: [0, 0],
				bearing: 0,
				outline: [
					[0, 0],
					[10, 10],
					[0, 8],
					[15, 0]
				]
			}
		})
	).toThrow(RangeError);
});

for (const variant of planVariants) {
	test(`${variant} retains polygons and neighbors while growing the site`, () => {
		const small = TerrainGrid.create({ ...options, variant, parameters: { cellSize: 10 } });
		const large = TerrainGrid.create({
			...options,
			variant,
			parameters: { cellSize: 10 },
			site: { ...options.site, length: 161, width: 113 }
		});
		const again = TerrainGrid.create({ ...options, variant, parameters: { cellSize: 10 } });
		expect(small).toEqual(again);
		expect(small.cells.length).toBeGreaterThan(0);
		expect(large.cells.length).toBeGreaterThan(small.cells.length);
		const cells = new Map(large.cells.map((cell) => [cell.id, cell]));
		const vertices = new Map(large.vertices.map((vertex) => [vertex.id, vertex.position]));
		let shared = 0;
		for (const { id, vertexIds, neighbors } of small.cells) {
			const retained = required(cells.get(id), 'retained plan cell');
			expect(retained.vertexIds).toEqual(vertexIds);
			expect(retained.neighbors).toHaveLength(vertexIds.length);
			for (const [i, neighbor] of neighbors.entries()) {
				if (neighbor === null) continue;
				shared++;
				expect(retained.neighbors[i]).toBe(neighbor);
				const adjacent = required(cells.get(neighbor), 'incident cell');
				const opposite = adjacent.vertexIds.indexOf(vertexIds[(i + 1) % vertexIds.length]);
				expect(adjacent.vertexIds[(opposite + 1) % adjacent.vertexIds.length]).toBe(vertexIds[i]);
				expect(adjacent.neighbors[opposite]).toBe(id);
			}
		}
		expect(shared).toBeGreaterThan(0);
		for (const { id, position } of small.vertices) expect(vertices.get(id)).toEqual(position);
	});
}

test('can limit grade across whole cells while still rejecting narrow wet cuts', () => {
	const site = { origin: [0, 0], bearing: 0, length: 240, width: 120 } as const;
	const options = { seed: 3, site, variant: 'square', parameters: { cellSize: 60 } } as const;
	const terrace = (x: number) => (x < 22 ? 0 : 8);
	const sampleGrade = TerrainGrid.create({ ...options, heightAt: terrace });
	const cellGrade = TerrainGrid.create({ ...options, heightAt: terrace, maximumCellGrade: 0.2 });
	const wet = TerrainGrid.create({
		...options,
		heightAt: (x) => (x > 21 && x < 25 ? undefined : terrace(x)),
		maximumCellGrade: 0.2
	});
	expect(cellGrade.cells.length).toBeGreaterThan(sampleGrade.cells.length);
	expect(wet.cells.length).toBe(sampleGrade.cells.length);
});

test('selects each cell once, keeping the first occurrence in the requested order', () => {
	const grid = TerrainGrid.create(options);
	const [first, second] = grid.cells;
	const expected = TerrainGrid.select(grid, [second.id, first.id]);
	expect(TerrainGrid.select(grid, [second.id, first.id, second.id, first.id])).toEqual(expected);
});

test('requires setback at the chords and interior of a square beside a circular lake', () => {
	const clear = (x: number, y: number) => Math.hypot(x + 179, y - 30) - 203;
	const base = {
		seed: 0,
		site: { origin: [0, 0] as const, bearing: 0, width: 240, length: 240 },
		variant: 'square' as const,
		parameters: { cellSize: 60 },
		heightAt: () => 0
	};
	const grid = TerrainGrid.create({
		...base,
		shore: { clearanceAt: clear, minimumEdge: 2, minimumArea: 200 }
	});
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	expect(grid.cells.length).toBeGreaterThan(0);
	for (const { vertexIds } of grid.cells) {
		for (const [i, id] of vertexIds.entries()) {
			const [x, y] = required(vertices.get(id), 'shore corner');
			const [u, v] = required(
				vertices.get(vertexIds[(i + 1) % vertexIds.length]),
				'next shore corner'
			);
			expect(clear((x + u) / 2, (y + v) / 2)).toBeGreaterThanOrEqual(0);
		}
	}
});

test('rejects a spacing whose subdivision count cannot be sampled', () => {
	expect(() => TerrainGrid.create({ ...options, edgeSampleStep: Number.MIN_VALUE })).toThrow(
		'sample subdivisions'
	);
});
