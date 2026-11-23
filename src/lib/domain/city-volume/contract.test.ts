import { expect, test } from 'bun:test';
import { TerrainGrid } from '../terrain-grid';
import {
	cityLatticesByPlan,
	createCityDistricts,
	createCityLattice,
	readCityColumns
} from './index';
import { example } from './example';

test('snaps the seeded district peak to the city level, independently of the outline', () => {
	const seed = 1201;
	const site = { origin: [0, 0], bearing: 0, length: 240, width: 100 } as const;
	const initial = TerrainGrid.create({ seed, site, variant: 'square', heightAt: () => 0 });
	const low = createCityDistricts(initial, site.origin, seed, { height: 36, complexity: 1 });
	const high = createCityDistricts(initial, site.origin, seed, { height: 139, complexity: 1 });
	const other = createCityDistricts(initial, site.origin, seed + 1, { height: 36, complexity: 1 });
	expect(low.peakHeight).toBe(35);
	expect(high.peakHeight).toBe(140);
	const cells = readCityColumns(initial, low);
	expect(cells.map(({ districtId }) => districtId)).toEqual(
		readCityColumns(initial, high).map(({ districtId }) => districtId)
	);
	expect(cells.map(({ districtId }) => districtId)).not.toEqual(
		readCityColumns(initial, other).map(({ districtId }) => districtId)
	);
	expect(example().lattice.cells.length).toBeGreaterThan(0);
});

test('uses the same prism faces for all square frames, including a terrain-fitting first bay', () => {
	const corners = [
		{ id: 'a', position: [0, 0, 0] },
		{ id: 'b', position: [14, 0, 1] },
		{ id: 'c', position: [14, 14, 2] },
		{ id: 'd', position: [0, 14, 3] }
	] as const;
	const columns = [
		{
			planCellId: 'square',
			corners,
			neighbors: [null, null, null, null],
			districtId: 'detached/0',
			kind: 'detached',
			levels: 1
		}
	] as const;
	const [box, braced, centered, tetrahedral] = cityLatticesByPlan.square.map((frame) =>
		createCityLattice(columns, 10, 'square', frame)
	);
	for (const lattice of [braced, centered, tetrahedral]) {
		expect(lattice.cells).toEqual(box.cells);
		expect(lattice.faces).toEqual(box.faces);
	}
	expect(box.edges).toHaveLength(12);
	expect(braced.edges).toHaveLength(16);
	expect(centered.edges).toHaveLength(20);
	expect(tetrahedral.edges).toHaveLength(19);
	expect(box.nodes.find(({ id }) => id === 'vertex/b/level/0')?.position).toEqual([14, 0, 1]);
	expect(box.nodes.find(({ id }) => id === 'vertex/b/level/1')?.position).toEqual([14, 0, 17]);
	expect(centered.nodes.find(({ id }) => id.endsWith('/center'))?.position).toEqual([7, 7, 9.25]);
	expect(() => createCityLattice(columns, -4, 'square')).toThrow(RangeError);
});
