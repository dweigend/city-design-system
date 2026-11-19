import { expect, test } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { houseSurfaces, houseLinks, planHouse, type HouseObstacle } from './index';

const grid = squareGrid(7, 5, 10);
const house = (id: string, n: number) =>
	planHouse({
		cells: [grid.cellsById.get(id)!],
		stacks: new Map([[id, Array<'living'>(n).fill('living')]]),
		seed: 11
	});

test('a nearby occupied plot diverts the walking surface while a fourth-ring neighbour stays disconnected', () => {
	const a = house('0/2', 2),
		b = house('3/2', 2),
		far = house('4/2', 1);
	const [ax, ay] = a.base,
		[bx] = b.base;
	const obstacle: HouseObstacle = { position: [(ax + bx) / 2, ay, 0], size: [4, 6, 30] };
	const [link] = houseLinks(grid, [a, b], 11, [obstacle]);
	expect(link.route.length).toBeGreaterThan(2);
	for (let i = 1; i < link.route.length; i++) {
		const start = link.route[i - 1],
			end = link.route[i];
		for (let step = 0; step <= 40; step++) {
			const t = step / 40,
				x = start[0] + t * (end[0] - start[0]),
				y = start[1] + t * (end[1] - start[1]);
			expect(
				Math.abs(x - obstacle.position[0]) > 2 + link.width / 2 ||
					Math.abs(y - ay) > 3 + link.width / 2
			).toBe(true);
		}
	}
	expect(houseLinks(grid, [a, far], 11)).toHaveLength(0);
});
test('every member of a three-house line has a link, in either input order', () => {
	const houses = [house('0/2', 2), house('2/2', 4), house('4/2', 9)];
	const forward = houseLinks(grid, houses, 5),
		reverse = houseLinks(grid, [...houses].reverse(), 5);
	expect(new Set(forward.flatMap((l) => [l.a, l.b])).size).toBe(3);
	expect(reverse).toEqual(forward);
});

test('the bridge uses the external access surface for every span member', () => {
	const sites = [house('0/0', 3), house('2/0', 5)];
	const access = { finish: 'wood', token: '--signal', material: 'wood' } as const;
	const [link] = houseLinks(grid, sites, 11);
	const [changed] = houseLinks(grid, sites, 11, [], { ...houseSurfaces, access });
	expect(changed.parts).toEqual(link.parts.map((p) => ({ ...p, ...access })));
});
