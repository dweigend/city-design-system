import { test, expect } from 'bun:test';
import { cityMovementNetwork, openingScene } from './index';

test('a generated town exposes court docks and the complete curved rail alignment to routing', () => {
	const { world } = openingScene(7);
	const graph = cityMovementNetwork(world, 120);
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	for (const edge of graph.edges) {
		expect(ports.has(edge.from) && ports.has(edge.to)).toBe(true);
		expect(Number.isFinite(edge.grade) && Number.isFinite(edge.length)).toBe(true);
	}
	expect(graph.edges.some((e) => ports.get(e.from)?.kind === 'court' && e.kind === 'dock')).toBe(
		true
	);
	for (const line of world.lines) {
		const rides = graph.edges.filter(
			(e) => e.mode === 'rail' && e.id.startsWith('transit/' + line.id + '/')
		);
		expect(rides).toHaveLength(line.stops.length - 1);
		expect(rides.reduce((total, e) => total + e.length, 0)).toBeCloseTo(line.length, 5);
	}
});
