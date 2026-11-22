import { expect, test } from 'bun:test';
import { required } from '../../core/invariant';
import { TerrainGrid } from '../terrain-grid';
import { CityVolume, levelHeight } from './index';
import { example } from './example';

const seed = 1201;
const datum = { origin: [0, 0], bearing: 0, length: 380, width: 152 } as const;

function plan(length: number = datum.length, width: number = datum.width) {
	return TerrainGrid.create({
		seed,
		site: { ...datum, length, width },
		parameters: { cellSize: 20 },
		heightAt: () => 0
	});
}

test('samples a continuous profile across cell edges and falls low at the outline', () => {
	const terrain = plan();
	const { profile } = CityVolume.create({ seed, datum, plan: terrain });
	const vertices = new Map(terrain.vertices.map(({ id, position }) => [id, position]));
	const boundary = new Set(terrain.boundary.flatMap((edge) => [...edge]));
	for (const { vertexIds, neighbors } of terrain.cells) {
		for (const [i, neighbor] of neighbors.entries()) {
			const [ax, ay] = required(vertices.get(vertexIds[i]), 'plan corner');
			const [bx, by] = required(vertices.get(vertexIds[(i + 1) % 4]), 'plan corner');
			const x = (ax + bx) / 2;
			const y = (ay + by) / 2;
			const dx = (by - ay) * 1e-6;
			const dy = (ax - bx) * 1e-6;
			expect(profile.height(x + dx, y + dy)).toBeCloseTo(profile.height(x - dx, y - dy), 3);
			if (!neighbor) expect(profile.height(x, y)).toBeLessThan(18);
		}
	}
	for (const id of boundary) {
		const [x, y] = required(vertices.get(id), 'plan vertex');
		expect(profile.height(x, y)).toBeLessThan(18);
	}
	expect(profile.height(...profile.summit)).toBeCloseTo(96, 8);
});

test('repeats the same seed and scales every sample without moving the summit', () => {
	const options = { seed, datum, plan: plan() };
	const a = CityVolume.create(options);
	const b = CityVolume.create(options);
	const high = CityVolume.create({ ...options, parameters: { height: 144 } });
	const other = CityVolume.create({ ...options, seed: seed + 1 });
	expect(high.profile.summit).toEqual(a.profile.summit);
	expect(other.profile.summit).not.toEqual(a.profile.summit);
	expect(a.grid).toEqual(b.grid);
	for (const {
		position: [x, y]
	} of options.plan.vertices) {
		expect(a.profile.height(x, y)).toBe(b.profile.height(x, y));
		expect(high.profile.height(x, y)).toBeCloseTo(a.profile.height(x, y) * 1.5, 10);
	}
});

test('retains the levels and IDs of existing cells through growth', () => {
	const options = { seed, datum };
	const small = CityVolume.create({ ...options, plan: plan() }).grid;
	const big = CityVolume.create({ ...options, plan: plan(620, 300) }).grid;
	const larger = new Map(big.columns.map((column) => [column.planCellId, column]));
	expect(big.columns.length).toBeGreaterThan(small.columns.length);
	for (const column of small.columns) expect(larger.get(column.planCellId)).toEqual(column);
	const ids = new Set(big.cells.map(({ id }) => id));
	expect(ids.size).toBe(big.cells.length);
	for (const { id } of small.cells) expect(ids.has(id)).toBe(true);
	expect(Math.max(...example().grid.columns.map(({ levels }) => levels))).toBe(6);
});

test('adds two distinct shoulders and saddles to the broad dome', () => {
	const options = { seed, datum, plan: plan(440, 220) };
	function maxima(complexity: number) {
		const { profile } = CityVolume.create({ ...options, parameters: { complexity } });
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
	expect(peaks[0]).toBeGreaterThan(6 * levelHeight);
	expect(peaks[2]).toBeGreaterThan(3 * levelHeight);
});

test('counts only full levels at plan cell centers', () => {
	const terrain = plan();
	const { profile, grid } = CityVolume.create({
		seed,
		datum,
		plan: terrain,
		parameters: { height: 16 }
	});
	const vertices = new Map(terrain.vertices.map(({ id, position }) => [id, position]));
	for (const [i, cell] of terrain.cells.entries()) {
		const [x, y] = cell.vertexIds.reduce(
			([x, y], id) => {
				const [u, v] = required(vertices.get(id), 'plan vertex');
				return [x + u / 4, y + v / 4];
			},
			[0, 0]
		);
		expect(grid.columns[i]).toEqual({
			planCellId: cell.id,
			levels: Math.floor(profile.height(x, y) / levelHeight)
		});
	}
});
