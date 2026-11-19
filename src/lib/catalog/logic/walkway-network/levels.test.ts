import { expect, test } from 'bun:test';
import { planNetwork, type NetworkInput } from './index';

function street(offset: number, ground: number): NetworkInput {
	const houses = Array.from({ length: 8 }, (_, i) => ({
		id: String(i),
		entrance: [i * 16, 0] as [number, number],
		ports: i < 3 ? [[i * 16, -offset, 2 + ground] as [number, number, number]] : [],
		obstacles: [
			{
				position: [i * 16, 5, ground] as [number, number, number],
				size: [4, 4, 6] as [number, number, number]
			}
		]
	}));
	return { houses, datum: ground, terrain: () => ground, ensembleArea: 3000, blockedCells: [] };
}
for (const ground of [-3, 0, 2])
	for (const offset of [8, 25]) {
		test(`one common ascent and supported deck chain at sole ${ground}, approach ${offset} m`, () => {
			const net = planNetwork(street(offset, ground), 13);
			const raised = net.edges.filter((e) => e.kind === 'deck');
			expect(raised).toHaveLength(2);
			const flights = net.edges.filter((e) => e.kind === 'ramp' || e.kind === 'stair');
			expect(flights).toHaveLength(1);
			const [flight] = flights,
				[a, b] = flight.points,
				run = Math.hypot(b[0] - a[0], b[1] - a[1]);
			if (offset === 25) {
				expect(flight.kind).toBe('ramp');
				expect((b[2] - a[2]) / run).toBeLessThanOrEqual(0.08);
			} else {
				const steps = net.geometry.filter((g) => g.id.startsWith(flight.id + '/tread/'));
				expect(flight.kind).toBe('stair');
				expect(steps).toHaveLength(12);
				expect((b[2] - a[2]) / steps.length).toBeLessThanOrEqual(0.17);
				expect(run / steps.length).toBeCloseTo(0.29, 9);
			}
			for (const e of raised) {
				expect(e.points.every((p) => p[2] === ground + 2)).toBe(true);
				const piers = net.geometry.flatMap((g) =>
					g.id.startsWith(e.id + '/') && g.kind === 'cylinder' ? [g.position] : []
				);
				expect(piers.length).toBeGreaterThan(0);
				const supports = [e.points[0], ...piers, e.points[e.points.length - 1]];
				for (let i = 1; i < supports.length; i++)
					expect(
						Math.hypot(supports[i][0] - supports[i - 1][0], supports[i][1] - supports[i - 1][1])
					).toBeLessThanOrEqual(12);
			}
			expect(
				net.geometry.every((g) => !('token' in g) && ['frame', 'deck', 'access'].includes(g.slot))
			).toBe(true);
		});
	}
test('ground traffic excludes a bridge inside its three metre corridor', () => {
	const net = planNetwork(street(2, 0), 2);
	expect(net.edges.every((e) => e.kind === 'ground')).toBe(true);
});
test('invalid deck level and nonfinite sampled height are rejected', () => {
	const input = street(8, 0);
	expect(() => planNetwork({ ...input, datum: 1 }, 1)).toThrow(RangeError);
	expect(() => planNetwork({ ...input, terrain: () => NaN }, 1)).toThrow(RangeError);
});
