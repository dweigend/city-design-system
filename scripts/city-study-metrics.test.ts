import { expect, test } from 'bun:test';
import {
	createCityDistricts,
	createCityLattice,
	readCityColumns
} from '../src/lib/domain/city-volume';
import { TerrainGrid } from '../src/lib/domain/terrain-grid';
import { latticeReplayStable } from './city-study-metrics';

test('a non-prism lattice replay detects a changed datum', () => {
	const seed = 1201;
	const origin = [0, 0] as const;
	const site = { origin, bearing: 0, length: 360, width: 300 };
	const plan = TerrainGrid.create({ site, seed, variant: 'square', heightAt: () => 0 });
	const columns = readCityColumns(
		plan,
		createCityDistricts(plan, { origin, bearing: 0, aspect: 1 }, seed)
	);
	const frame = createCityLattice(columns, 0, 'antiprism');
	expect(frame.nodes.length).toBeGreaterThan(0);
	expect(latticeReplayStable(frame, columns, 0, 'antiprism')).toBe(true);
	expect(latticeReplayStable(frame, columns, 1, 'antiprism')).toBe(false);
});
