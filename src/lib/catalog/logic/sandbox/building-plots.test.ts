import { expect, test } from 'bun:test';
import init from 'manifold-3d';
import { createRoofBuilder } from '../building-envelope';
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

test('snapping preserves the full perpendicular width on both owners of every seed-7 passage', () => {
	for (const cell of terrain.cells.filter((c) => c.lotCorners)) {
		checkPassageWidth(cell);
	}
	for (const id of ['114/89', '106/72', '107/72'])
		expect(terrain.cellsById.get(id)?.lotCorners).toBeDefined();
	const a = plots.cellsById.get('106/72'),
		b = plots.cellsById.get('107/72');
	expect(a?.neighbors).toContain(b?.id);
	expect(b?.neighbors).toContain(a?.id);
});

function checkPassageWidth(cell: (typeof terrain.cells)[number]) {
	const side = cell.alleyEdges & 1 ? 0 : 2,
		a = cell.corners[side],
		b = cell.corners[(side + 1) % 4];
	const dx = b[0] - a[0],
		dy = b[1] - a[1];
	for (const p of plots.cells[cell.index].corners) {
		expect((dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / Math.hypot(dx, dy)).toBeGreaterThanOrEqual(
			cell.plan.width
		);
	}
}

test('pencil and K1 share the transverse axis on the final inset lot 106/72', async () => {
	const cell = plots.cellsById.get('106/72');
	if (!cell) throw new Error('missing lot');
	const stacks = new Map<string, HouseUse[]>([[cell.id, ['living']]]);
	const parts = houseChunk(plots, stacks, cell.chunk, 7);
	const ridge = parts.find((p) => p.id.endsWith(':ridge'));
	if (ridge?.kind !== 'polyline') throw new Error('missing ridge');
	const [a, , b] = ridge.points;
	// P1 selects the transverse axis at this address.
	const sides = cell.corners.map(([x, y], i) => [
		cell.corners[(i + 1) % 4][0] - x,
		cell.corners[(i + 1) % 4][1] - y
	]);
	const [x, y] = sides.reduce((a, b) => (Math.hypot(...a) >= Math.hypot(...b) ? a : b));
	const angle = Math.atan2(y, x) + Math.PI / 2;
	const kernel = await init();
	kernel.setup();
	const builder = createRoofBuilder(kernel, (_id, error) => {
		throw error;
	});
	const meshParts = houseChunk(plots, stacks, cell.chunk, 7, 'terrace', undefined, {
		...builder,
		build(spec, seat) {
			expect(spec.params?.direction).toBeCloseTo(angle, 12);
			return builder.build(spec, seat);
		}
	});
	expect(meshParts.some((part) => part.kind === 'mesh' && part.roofCell === cell.id)).toBe(true);
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	expect(length).toBeGreaterThan(0);
	expect(((b[0] - a[0]) * Math.sin(angle) - (b[1] - a[1]) * Math.cos(angle)) / length).toBeCloseTo(
		0,
		12
	);
});
