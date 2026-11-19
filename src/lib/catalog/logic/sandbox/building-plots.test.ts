// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { houseChunk, type HouseUse } from '../house-brush';
import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';
import { buildingPlots } from './building-plots';

const terrain = deriveGrid(createTerrain({ seed: 7 }));
const plots = buildingPlots(terrain);
test('three inset seed-7 lots along a main alley form one house with a continuous wall', () => {
	const ids = ['59/36', '60/36', '61/36'];
	for (const id of ids) expect(terrain.cellsById.get(id)?.lotCorners).toBeDefined();
	const stacks = new Map(ids.map((id) => [id, ['living'] as HouseUse[]]));
	const lot = plots.cellsById.get(ids[0]);
	if (!lot) throw new Error('missing lot');
	const walls = houseChunk(plots, stacks, lot.chunk, 7).filter((p) => p.id.endsWith(':wall'));
	expect(walls).toHaveLength(1);
	expect(walls[0]).toMatchObject({ id: '59/36@0:wall', kind: 'prism' });
	for (const [i, id] of ids.slice(1).entries()) {
		const a = plots.cellsById.get(ids[i]),
			b = plots.cellsById.get(id);
		if (!a || !b) throw new Error(id);
		const side = a.neighbors.indexOf(b.id),
			opposite = b.neighbors.indexOf(a.id);
		expect(side).toBeGreaterThanOrEqual(0);
		expect(opposite).toBeGreaterThanOrEqual(0);
		expect(a.vertexIds[side]).toBe(b.vertexIds[(opposite + 1) % 4]);
		expect(a.corners[side]).toEqual(b.corners[(opposite + 1) % 4]);
	}
});
test('a physical step between two passage footprints keeps their walls separate', () => {
	const separated = terrain.cells.find(
		(a) =>
			a.lotCorners &&
			a.neighbors.some(
				(id) =>
					id &&
					terrain.cellsById.get(id)?.lotCorners &&
					!plots.cells[a.index].neighbors.includes(id)
			)
	);
	expect(separated).toBeDefined();
});
