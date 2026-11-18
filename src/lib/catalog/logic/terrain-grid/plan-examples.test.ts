// @ts-expect-error Bun provides the test API.
import { expect, test } from 'bun:test';
import { createWorld } from '../sandbox';
import { createTerrain, ravineDepth } from '../terrain';
import { deriveGrid } from './index';
const terrain = createTerrain({ seed: 7 });
const grid = deriveGrid(terrain);
const cell = (id: string) => grid.cellsById.get(id);
test('five seed-7 addresses pin the crossing, stair, square, bank and alley', () => {
	expect(cell('72/7')?.plan).toMatchObject({ bridge: true, open: true, direction: 'across' });
	expect(cell('96/19')?.plan).toMatchObject({ stairs: true, direction: 'across' });
	expect(cell('47/40')?.plan).toMatchObject({ square: true, direction: 'along' });
	expect(cell('59/23')?.plan).toMatchObject({ width: 5, direction: 'along' });
	expect(cell('108/19')?.plan).toMatchObject({ width: 0.75, direction: 'across' });
});
test('the world validates and forwards plan controls', () => {
	expect(() => createWorld(7, { plan: { terraceRows: 0 } })).toThrow(RangeError);
	const world = createWorld(7, { plan: { riverWidth: 4, bridgeTone: 0.12 } });
	expect(world.grid.cellsById.get('59/23')?.plan.width).toBe(4);
	expect(world.grid.profile.bridgeTone).toBe(0.12);
});
test('a basin cut into a terrace deepens its incision', () => {
	const site = cell('47/40');
	if (!site) throw new Error('missing terrace');
	const [x, y] = site.center;
	const dug = createTerrain({ seed: 7, edits: [{ kind: 'basin', center: [x, y], radius: 9 }] });
	expect(ravineDepth(dug, x, y)).toBeGreaterThan(ravineDepth(terrain, x, y) + 1);
});
