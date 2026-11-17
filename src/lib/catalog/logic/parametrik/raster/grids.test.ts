import { describe, expect, test } from 'bun:test';
import { gridGenerators, contourGrid, voronoiGrid } from './index';
import { area, cross } from './geometry';
import { divide, field, occupy, path, shortestPath } from './operatoren';
import { compose, compositionRules, placeholder } from '../komposition';
const generate = (kind: string) => gridGenerators.find((g) => g.kind === kind)!.generate({}, 42);
for (const generator of gridGenerators)
	describe(generator.kind, () => {
		test('valid CCW cells, symmetric graph and deterministic seeds', () => {
			for (const seed of [0, 42, 317]) {
				const g = generator.generate({}, seed);
				expect(g).toEqual(generator.generate({}, seed));
				expect(g.cells.length).toBeGreaterThan(0);
				const byId = new Map(g.cells.map((c) => [c.id, c]));
				expect(byId.size).toBe(g.cells.length);
				for (const c of g.cells) {
					expect(c.polygon.length).toBeGreaterThanOrEqual(3);
					expect(area(c.polygon)).toBeGreaterThan(0);
					expect(c.area).toBeCloseTo(area(c.polygon), 6);
					expect(c.center.every(Number.isFinite)).toBe(true);
					expect(Number.isFinite(c.orientation)).toBe(true);
					expect(
						c.polygon.every(
							(p, i) => cross(p, c.polygon[(i + 1) % c.polygon.length], c.center) >= -1e-5
						)
					).toBe(true);
					for (const id of c.neighbors) {
						expect(byId.get(id)?.neighbors).toContain(c.id);
						expect(
							g.links.some(([a, b]) => (a === id && b === c.id) || (a === c.id && b === id))
						).toBe(true);
					}
				}
				expect(g.links.length * 2).toBe(g.cells.reduce((s, c) => s + c.neighbors.length, 0));
			}
		});
		test('conserves domain area', () => {
			const g = generator.generate({}, 42),
				sum = g.cells.reduce((s, c) => s + c.area, 0);
			const expected = {
				square: 625,
				axis: 25.2 ** 2,
				triangle: (25 * 25 * Math.sqrt(3)) / 2,
				hex: (19 * 3 * Math.sqrt(3) * 25) / 2,
				'quad-irregular': (19 * 3 * Math.sqrt(3) * 25) / 2,
				voronoi: 900,
				polar: (12 / 2) * Math.sin((2 * Math.PI) / 12) * 15 ** 2,
				contour: 585,
				vertical: 675
			};
			expect(sum).toBeCloseTo(expected[g.kind], 3);
		});
	});
test('irregular seed changes geometry and every resulting cell is a quad', () => {
	const gen = gridGenerators.find((g) => g.kind === 'quad-irregular')!;
	expect(gen.generate({}, 1)).not.toEqual(gen.generate({}, 2));
	expect(gen.generate({}, 1).cells.every((c) => c.polygon.length === 4)).toBe(true);
});
test('polygon clipping conserves concave domain', () => {
	const boundary: [number, number][] = [
		[0, 0],
		[10, 0],
		[10, 5],
		[5, 5],
		[5, 10],
		[0, 10]
	];
	for (const g of [contourGrid(boundary, 3, 31), voronoiGrid(boundary, 12, 17, 2)])
		expect(g.cells.reduce((s, c) => s + c.area, 0)).toBeCloseTo(75, 5);
});
test('field, seeded occupation, division and paths preserve input', () => {
	const g = generate('square'),
		before = structuredClone(g),
		f = field(g, g.cells[0].center, 5);
	expect(f.cells[0].fields?.density).toBe(1);
	expect(occupy(g, 0.5, 17)).toEqual(occupy(g, 0.5, 17));
	const d = divide(g, [g.cells[0].id]);
	expect(d.cells.length).toBe(g.cells.length + 3);
	expect(d.cells.reduce((s, c) => s + c.area, 0)).toBeCloseTo(625, 6);
	const ids = shortestPath(g, g.cells[0].id, g.cells.at(-1)!.id);
	expect(ids.length).toBe(9);
	expect(path(g, ids[0], ids.at(-1)!, 'pipe')[0].kind).toBe('pipe');
	expect(shortestPath(g, 'missing', ids[0])).toEqual([]);
	expect(g).toEqual(before);
});
test('composition landmark, courtyard, network and extension semantics', () => {
	const g = generate('square');
	for (const r of compositionRules) {
		const p = compose(g, [r], [placeholder], 42);
		expect(p).toEqual(compose(g, [r], [placeholder], 42));
		expect(new Set(p.map((p) => p.id)).size).toBe(p.length);
		if (r.id === 'landmarke') expect(p.length).toBe(1);
		if (r.id === 'hof') expect(p.length).toBe(16);
		if (r.id === 'netz') expect(p.filter((p) => p.kind === 'pipe').length).toBe(g.links.length);
		if (r.id === 'aufstockung') {
			expect(p.filter((p) => p.role === 'bestand').length).toBe(25);
			expect(
				p
					.filter((p) => p.kind === 'prism' && p.role === 'neu')
					.every((p) => p.kind === 'prism' && p.z === 4)
			).toBe(true);
		}
	}
});
test('invalid domain parameters fail instead of looping', () => {
	expect(() => contourGrid([], 0)).toThrow();
	expect(() => voronoiGrid([], 10)).toThrow();
	expect(() =>
		voronoiGrid(
			[
				[0, 0],
				[1, 0],
				[0, 1]
			],
			-1
		)
	).toThrow();
});
test('vertical additions only occupy the roof and keep every existing floor', () => {
	const g = generate('vertical');
	const result = compose(
		g,
		compositionRules.filter((r) => r.id === 'aufstockung'),
		[placeholder]
	);
	expect(result.filter((p) => p.role === 'bestand').length).toBe(27);
	const additions = result.filter((p) => p.role === 'neu');
	expect(additions.length).toBe(9);
	expect(additions.every((p) => p.kind === 'prism' && p.z === 12)).toBe(true);
});
test('contour: band along the free contour, rotated interior, no fans or slivers', () => {
	const gen = gridGenerators.find((g) => g.kind === 'contour')!;
	for (const notch of [0, 7, 12])
		for (const angle of [0, 17, 45]) {
			const g = gen.generate({ notch, angle, size: 5 }, 1);
			// A fan shows up as many cells meeting in one point.
			const valence = new Map<string, number>();
			for (const c of g.cells)
				for (const p of c.polygon) {
					const k = p.map((v) => v.toFixed(4)).join(',');
					valence.set(k, (valence.get(k) ?? 0) + 1);
				}
			expect(Math.max(...valence.values())).toBeLessThanOrEqual(5);
			expect(g.cells.filter((c) => c.area < 25 * 0.15).length).toBeLessThanOrEqual(1);
			expect(g.cells.every((c) => c.polygon.length <= 8)).toBe(true);
		}
});
