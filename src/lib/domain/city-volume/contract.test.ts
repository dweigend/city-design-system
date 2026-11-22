import { expect, test } from 'bun:test';
import type { Vec2 } from '../../core/geometry';
import { TerrainGrid, planVariants } from '../terrain-grid';
import {
	createCityLattice,
	createCityProfile,
	latticeVariants,
	levelHeight,
	readCityColumns
} from './index';
import { example } from './example';

const seed = 1201;
const datum = { origin: [0, 0], bearing: 0, length: 380, width: 152 } as const;

test('samples a smooth seeded field with a 120 m peak and a low outer edge', () => {
	const profile = createCityProfile(datum, seed);
	const same = createCityProfile(datum, seed);
	const high = createCityProfile(datum, seed, { height: 144 });
	const other = createCityProfile(datum, seed + 1);
	expect(profile.height(...profile.summit)).toBeCloseTo(120, 8);
	expect(profile.height(-190, 60)).toBeLessThan(22);
	expect(profile.height(profile.summit[0], profile.summit[1] + 35)).toBeLessThan(50);
	expect(high.summit).toEqual(profile.summit);
	expect(other.summit).not.toEqual(profile.summit);
	for (let x = -180; x <= 180; x += 10) {
		const y = x / 3;
		expect(profile.height(x, y)).toBe(same.height(x, y));
		expect(high.height(x, y)).toBeCloseTo(profile.height(x, y) * 1.2, 10);
		expect(profile.height(x + 1e-6, y)).toBeCloseTo(profile.height(x - 1e-6, y), 4);
	}
	expect(example().lattice.cells.length).toBeGreaterThan(0);
});

test('complexity adds two distinct shoulders with intervening saddles', () => {
	function maxima(complexity: number) {
		const profile = createCityProfile(datum, seed, { complexity });
		const peaks: number[] = [];
		for (let x = -180; x <= 180; x += 2) {
			for (let y = -70; y <= 70; y += 2) {
				const height = profile.height(x, y);
				const neighbors = [-2, 0, 2].flatMap((dx) =>
					[-2, 0, 2]
						.filter((dy) => dx !== 0 || dy !== 0)
						.map((dy) => profile.height(x + dx, y + dy))
				);
				if (height > 40 && neighbors.every((other) => height > other)) peaks.push(height);
			}
		}
		return peaks.sort((a, b) => b - a);
	}
	expect(maxima(0)).toHaveLength(1);
	const peaks = maxima(1);
	expect(peaks).toHaveLength(3);
	expect(peaks[0]).toBeGreaterThan(8 * levelHeight);
	expect(peaks[2]).toBeGreaterThan(3 * levelHeight);
});

for (const variant of planVariants) {
	for (const frame of latticeVariants) {
		test(`${variant} × ${frame} keeps complete levels, stable joints and unique edges`, () => {
			const profile = createCityProfile(datum, seed);
			const planAt = (length: number, width: number) =>
				TerrainGrid.create({
					seed,
					variant,
					site: { ...datum, length, width },
					heightAt: (x, y) => x / 20 + y / 14
				});
			const columns = readCityColumns(planAt(240, 100), profile);
			const lattice = createCityLattice(columns, frame);
			const large = createCityLattice(readCityColumns(planAt(360, 150), profile), frame);
			const repeat = createCityLattice(
				readCityColumns(planAt(240, 100), createCityProfile(datum, seed)),
				frame
			);
			expect(lattice).toEqual(repeat);
			expect(lattice.cells.length).toBeGreaterThan(0);
			expect(large.cells.length).toBeGreaterThan(lattice.cells.length);
			expect(lattice.cells).toHaveLength(columns.reduce((sum, column) => sum + column.levels, 0));
			for (const { corners, levels } of columns) {
				const center = corners.reduce<Vec2>(
					([x, y], { position: [u, v] }) => [x + u / corners.length, y + v / corners.length],
					[0, 0]
				);
				expect(levels).toBe(Math.floor(profile.height(...center) / levelHeight));
			}
			for (const key of ['cells', 'nodes', 'edges'] as const) {
				const entries = new Map(large[key].map((item) => [item.id, item]));
				expect(entries.size).toBe(large[key].length);
				for (const item of lattice[key]) expect(entries.get(item.id)).toEqual(item);
			}
			const nodes = new Set(lattice.nodes.map(({ id }) => id));
			for (const { from, to } of lattice.edges) {
				expect(nodes.has(from)).toBe(true);
				expect(nodes.has(to)).toBe(true);
				expect(from < to).toBe(true);
			}
		});
	}
}

test('the same levels receive the box, diagonal or body-centered members', () => {
	const corners = [
		{ id: 'a', position: [0, 0, 0] },
		{ id: 'b', position: [14, 0, 0] },
		{ id: 'c', position: [14, 14, 0] },
		{ id: 'd', position: [0, 14, 0] }
	] as const;
	const column = { planCellId: 'square', corners, levels: 1 };
	const [box, braced, centered, tetrahedral] = latticeVariants.map((frame) =>
		createCityLattice([column], frame)
	);
	expect(box.cells).toEqual(braced.cells);
	expect(box.cells).toEqual(centered.cells);
	expect(box.cells).toEqual(tetrahedral.cells);
	expect(box.edges).toHaveLength(12);
	expect(braced.edges).toHaveLength(16);
	expect(centered.edges).toHaveLength(20);
	expect(tetrahedral.edges).toHaveLength(19);
	expect(centered.nodes.find(({ id }) => id.endsWith('/center'))?.position).toEqual([7, 7, 7]);
});
