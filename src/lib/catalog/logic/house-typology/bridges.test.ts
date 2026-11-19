import { test, expect } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { composeHouse, planBridges } from './index';
const grid = squareGrid(3, 3, 10);
function house(index: number, x: number, z = 4) {
	const c = grid.cells[index],
		site = { seed: 1, cells: [c], stacks: new Map([[c.id, ['living' as const]]]) };
	return {
		...composeHouse(site),
		ports: [{ level: 0, position: [x, 0, z] as [number, number, number] }]
	};
}
test('level tolerance, span and intermediate bearing have inclusive limits', () => {
	const a = house(0, 0);
	for (const [span, count, pier] of [
		[12, 1, false],
		[12.01, 1, true],
		[20, 1, true],
		[20.01, 0, false]
	] as const) {
		const links = planBridges([a, house(1, span, 4.3)]);
		expect(links).toHaveLength(count);
		if (count) {
			expect(!!links[0].pier).toBe(pier);
			expect(links[0].from[2]).toBe(links[0].to[2]);
		}
	}
	expect(planBridges([a, house(1, 10, 4.301)])).toEqual([]);
	expect(planBridges([a, house(2, 10)])).toEqual([]);
});
test('a four-arm junction admits at most two branches', () => {
	const sites = [1, 3, 4, 5, 7].map((n, i) => house(n, i));
	expect(planBridges(sites)).toHaveLength(2);
});
