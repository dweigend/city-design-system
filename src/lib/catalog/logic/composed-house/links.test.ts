import { required } from '../required';
import { expect, test } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { houseSurfaces, houseLinks, planHouse, type HouseObstacle } from './index';

const grid = squareGrid(7, 5, 10);
const house = (id: string, n: number) =>
	planHouse({
		cells: [required(grid.cellsById.get(id), 'test cell')],
		stacks: new Map([[id, Array<'living'>(n).fill('living')]]),
		seed: 11
	});

test('a nearby occupied plot diverts the walking surface while a distant neighbour stays disconnected', () => {
	const a = house('0/2', 4),
		b = house('2/2', 4),
		far = house('4/2', 4);
	const [ax, ay] = a.base,
		[bx] = b.base;
	const obstacle: HouseObstacle = { position: [(ax + bx) / 2, ay, 0], size: [2, 3, 30] };
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
				Math.abs(x - obstacle.position[0]) > 1 + link.width / 2 ||
					Math.abs(y - ay) > 1.5 + link.width / 2
			).toBe(true);
		}
	}
	expect(houseLinks(grid, [a, far], 11)).toHaveLength(0);
});
test('a line of three houses forms one chain at a shared deck level, in either input order', () => {
	const houses = [house('0/2', 4), house('2/2', 4), house('4/2', 9)];
	const forward = houseLinks(grid, houses, 5),
		reverse = houseLinks(grid, [...houses].reverse(), 5);
	expect(forward).toHaveLength(2);
	expect(new Set(forward.flatMap((l) => [l.a, l.b])).size).toBe(3);
	expect(reverse).toEqual(forward);
});
test('bridges are level, never stair bridges, and unequal deck levels stay apart', () => {
	expect(houseLinks(grid, [house('0/2', 1), house('1/2', 9)], 5)).toHaveLength(0);
	const block = ['1/1', '2/1', '3/1', '1/2', '2/2', '3/2', '1/3', '2/3', '3/3'];
	for (const seed of [1, 5, 11, 23]) {
		const links = houseLinks(
			grid,
			block.map((id, i) => house(id, 4 + (i % 3))),
			seed
		);
		const degree = new Map<string, number>();
		for (const link of links) {
			expect(link.kind).not.toBe('stair-bridge');
			expect(Math.abs(link.from[2] - link.to[2])).toBeLessThanOrEqual(0.3);
			for (const p of link.route) expect(Math.abs(p[2] - link.from[2])).toBeLessThanOrEqual(0.3);
			for (const id of [link.a, link.b]) degree.set(id, (degree.get(id) ?? 0) + 1);
		}
		expect(Math.max(...degree.values())).toBeLessThanOrEqual(2);
		// A forest over nine houses has at most eight spans; one ring is allowed per six houses.
		expect(links.length).toBeLessThanOrEqual(block.length);
		expect(links.length).toBeGreaterThan(0);
	}
});

test('the bridge uses the external access surface for every span member', () => {
	const sites = [house('0/0', 3), house('2/0', 5)];
	const access = { finish: 'wood', token: '--signal' } as const;
	const [link] = houseLinks(grid, sites, 11);
	const [changed] = houseLinks(grid, sites, 11, [], { ...houseSurfaces, access });
	expect(changed.parts).toEqual(link.parts.map((p) => ({ ...p, ...access, material: 'wood' })));
});
