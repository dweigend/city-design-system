import { expect, test } from 'bun:test';
import { planNetwork, type Network, type NetworkInput } from './index';

function district(count: number, irregular: boolean, slope: number): NetworkInput {
	const houses = Array.from({ length: count }, (_, i) => {
		const x = (i % 3) * 18 + (irregular ? Math.sin(i) * 1.7 : 0);
		const y = Math.floor(i / 3) * 16 + (irregular ? Math.cos(i) * 1.3 : 0);
		return {
			id: String(i).padStart(2, '0'),
			entrance: [x, y] as [number, number],
			obstacles: [
				{
					position: [x, y + 5, 0] as [number, number, number],
					size: [5, 5, 8] as [number, number, number]
				}
			]
		};
	});
	return {
		houses,
		terrain: (x, y) => slope * (x + 0.5 * y),
		ensembleArea: count * 290,
		blockedCells: [
			[
				[7, -1],
				[10, -2],
				[11, 1],
				[8, 2]
			]
		]
	};
}
function connected(net: Network) {
	const seen = new Set([net.nodes[0].id]);
	for (let pass = 0; pass < net.nodes.length; pass++)
		for (const edge of net.edges) {
			if (seen.has(edge.from) || seen.has(edge.to)) {
				seen.add(edge.from);
				seen.add(edge.to);
			}
		}
	expect(seen.size).toBe(net.nodes.length);
}
function safePoint(input: NetworkInput, p: [number, number, number]) {
	expect(p.every(Number.isFinite)).toBe(true);
	expect(p[2]).toBeCloseTo(input.terrain(p[0], p[1]), 8);
	for (const h of input.houses)
		for (const { position, size } of h.obstacles) {
			const dx = Math.max(Math.abs(p[0] - position[0]) - size[0] / 2, 0);
			const dy = Math.max(Math.abs(p[1] - position[1]) - size[1] / 2, 0);
			expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(1.625 - 1e-7);
		}
	const cell = input.blockedCells[0];
	expect(
		cell.every(([x, y], i) => {
			const q = cell[(i + 1) % cell.length];
			return (q[0] - x) * (p[1] - y) - (q[1] - y) * (p[0] - x) >= 0;
		})
	).toBe(false);
}
function properties(input: NetworkInput, seed: number) {
	const net = planNetwork(input, seed);
	connected(net);
	expect(net.edges.length - net.nodes.length + 1).toBeLessThanOrEqual(
		Math.floor(input.houses.length / 6)
	);
	expect(net.length).toBeLessThanOrEqual(1.6 * net.entranceMst + 1e-8);
	expect(net.planArea).toBeLessThanOrEqual(0.12 * input.ensembleArea);
	for (const h of input.houses) {
		expect(
			net.nodes.some(
				(n) =>
					n.houses.includes(h.id) &&
					n.position[0] === h.entrance[0] &&
					n.position[1] === h.entrance[1]
			)
		).toBe(true);
	}
	for (const e of net.edges) {
		const end = e.points[e.points.length - 1];
		expect(Math.hypot(e.points[0][0] - end[0], e.points[0][1] - end[1])).toBeLessThanOrEqual(
			25 + 1e-8
		);
		for (const p of e.points) safePoint(input, p);
	}
	expect(planNetwork(input, seed)).toEqual(net);
}
for (const irregular of [false, true])
	for (const count of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
		test(`${count} houses on ${irregular ? 'irregular' : 'square'} sites, three slopes and two seeds`, () => {
			for (const slope of [-0.035, 0, 0.06])
				for (const seed of [17, 43]) properties(district(count, irregular, slope), seed);
		});

test('moving a middle house on a street preserves every nonincident edge', () => {
	const input = district(9, false, 0);
	const houses = input.houses.map((h, i) => ({
		...h,
		entrance: [15 * i, 0] as [number, number],
		obstacles: [
			{
				position: [15 * i, 6, 0] as [number, number, number],
				size: [4, 4, 6] as [number, number, number]
			}
		]
	}));
	const original = planNetwork({ ...input, houses, blockedCells: [] }, 19);
	houses[4].entrance = [62, 1];
	houses[4].obstacles[0].position[0] = 62;
	const edited = planNetwork({ ...input, houses, blockedCells: [] }, 19);
	const remote = (n: Network) =>
		n.edges.filter((e) => e.points.every((p) => p[0] <= 45 || p[0] >= 75));
	expect(remote(original)).toHaveLength(6);
	expect(remote(edited)).toEqual(remote(original));
});
