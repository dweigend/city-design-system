import { expect, test } from 'bun:test';
import { planNetwork } from './index';

type Input = Parameters<typeof planNetwork>[0];
type House = Input['houses'][number];
function house(id: string, x: number, y: number): House {
	return { id, entrance: [x, y], obstacles: [{ position: [x, y + 5, 0], size: [4, 4, 8] }] };
}
function ensemble(houses: House[]): Input {
	return { houses, terrain: () => 0, blockedCells: [], ensembleArea: 1500 };
}

test('a third entrance joins the middle of a shared trunk', () => {
	const input = ensemble([house('a', 0, 0), house('b', 16, 0), house('c', 8, -7)]);
	const net = planNetwork(input, 11);
	expect(net.nodes.some((n) => n.kind === 'fork')).toBe(true);
	expect(net.edges.length).toBe(net.nodes.length - 1);
	expect(net.length).toBeLessThan(23);
});

test('a water cell diverts the trunk around its corners', () => {
	const input = ensemble([house('a', 0, 0), house('b', 16, 0), house('c', 22, 0)]);
	input.blockedCells = [
		[
			[6, -2],
			[10, -2],
			[10, 2],
			[6, 2]
		]
	];
	expect(planNetwork(input, 8).length).toBeGreaterThan(22);
});

test('a long straight run gets a deck plaza', () => {
	const net = planNetwork(ensemble([house('a', 0, 0), house('b', 45, 0), house('c', 55, 0)]), 2);
	expect(net.nodes.some((n) => n.kind === 'plaza')).toBe(true);
	expect(net.geometry.some((g) => g.slot === 'deck')).toBe(true);
});

test('one stair serves two neighbouring ports on the ensemble datum', () => {
	const a = house('a', 0, 0),
		b = house('b', 16, 0);
	a.ports = [[0, -8, 2]];
	b.ports = [[16, -8, 2]];
	const net = planNetwork(ensemble([a, b, house('c', 30, 0), house('d', 45, 0)]), 5);
	expect(net.edges.filter((e) => e.kind === 'stair')).toHaveLength(1);
	expect(net.edges.filter((e) => e.kind === 'deck')).toHaveLength(1);
});

test('an impossible area budget is reported at the call seam', () => {
	const input = ensemble([house('a', 0, 0), house('b', 10, 0), house('c', 20, 0)]);
	expect(() => planNetwork({ ...input, ensembleArea: 10 }, 0)).toThrow(RangeError);
});
