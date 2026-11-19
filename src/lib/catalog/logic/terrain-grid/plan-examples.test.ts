// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { createWorld } from '../sandbox';
import { createTerrain, ravineDepth } from '../terrain';
import { deriveGrid } from './index';
const terrain = createTerrain({ seed: 7 });
const grid = deriveGrid(terrain);
const cell = (id: string) => grid.cellsById.get(id);
test('five seed-7 addresses pin the crossing, stair, square, bank and alley', () => {
	expect(cell('72/7')?.plan).toMatchObject({ footbridge: true, open: true, direction: 'across' });
	expect(cell('96/19')?.plan).toMatchObject({ stairAlley: true, direction: 'across' });
	expect(cell('47/40')?.plan).toMatchObject({
		kind: 'mainAlley',
		square: true,
		direction: 'along'
	});
	expect(cell('59/23')?.plan).toMatchObject({
		kind: 'riversidePromenade',
		width: 4,
		direction: 'along'
	});
	expect(cell('108/19')?.plan).toMatchObject({ kind: 'alley', width: 1.8, direction: 'across' });
});
test('the world validates and forwards plan controls', () => {
	expect(() => createWorld(7, { plan: { terraceRows: 0 } })).toThrow(RangeError);
	const world = createWorld(7, { plan: { promenadeWidth: 4.5 } });
	expect(world.grid.cellsById.get('59/23')?.plan.width).toBe(4.5);
	for (const rows of [3, 5, 6, 7])
		expect(() => createWorld(7, { plan: { terraceRows: rows } })).toThrow(RangeError);
});
test('a basin cut into a terrace deepens its incision', () => {
	const site = cell('47/40');
	if (!site) throw new Error('missing terrace');
	const [x, y] = site.center;
	const dug = createTerrain({ seed: 7, edits: [{ kind: 'basin', center: [x, y], radius: 9 }] });
	expect(ravineDepth(dug, x, y)).toBeGreaterThan(ravineDepth(terrain, x, y) + 1);
});

test('the narrowest main passage meets its meter budget and leaves a smaller building plot', () => {
	const main = grid.cells.filter((c) => c.plan.kind === 'mainAlley');
	expect(Math.min(...main.map((c) => c.plan.width))).toBe(2.4);
	expect(Math.max(...main.map((c) => c.plan.width))).toBe(3.6);
	const lots = main.filter((c) => c.lotCorners);
	expect(lots.length).toBeGreaterThan(0);
	for (const cell of lots) {
		const side = cell.alleyEdges & 1 ? 0 : 2;
		const a = cell.corners[side],
			b = cell.corners[(side + 1) % 4];
		const dx = b[0] - a[0],
			dy = b[1] - a[1];
		for (const i of [side, (side + 1) % 4]) {
			const p = cell.lotCorners?.[i];
			if (!p) throw new Error(cell.id);
			expect((dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / Math.hypot(dx, dy)).toBeCloseTo(
				cell.plan.width,
				8
			);
		}
	}
});
