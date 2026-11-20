import { expect, test } from 'bun:test';
import { movementNetwork, type MovementPort, type MovementKind } from './index';

const profile = { width: 2, headroom: 2.2, rampGrade: 0.08, stairGrade: 0.6, capacity: 40 };
function port(
	id: string,
	kind: MovementKind,
	x: number,
	z: number,
	facing: number,
	accepts: MovementKind[]
): MovementPort {
	return { id, kind, position: [x, 0, z], heading: facing, width: 2.5, headroom: 3, accepts };
}
const path = port('lane', 'path', 5, 0, Math.PI, ['entrance', 'stair', 'tunnel']);
const exit = port('sill', 'entrance', 0, 0, 0, ['path', 'stair']);
function connection(a: MovementPort, b: MovementPort) {
	return movementNetwork([a, b], [], [{ id: 'connection', from: a.id, to: b.id, profile }]);
}

test('a house exit reaches the path within walking grade', () => {
	const graph = connection({ ...exit, position: [0, 0, 0.4] }, path);
	expect(graph.edges.map((e) => e.kind)).toEqual(['path']);
	expect(graph.edges[0].grade).toBeCloseTo(-0.08);
	expect(graph.edges[0].capacity).toBe(40);
	expect(graph.edges[0].width).toBe(profile.width);
	const ramp = connection(
		{ ...exit, accepts: ['ramp'], position: [0, 0, 0.4] },
		{ ...path, accepts: ['ramp'] }
	);
	expect(ramp.edges.map((e) => e.kind)).toEqual(['dock', 'ramp', 'dock']);
});

test('a high sill inserts a two-port flight between the house and path', () => {
	const graph = connection({ ...exit, position: [0, 0, 2] }, path);
	expect(graph.edges.map((e) => e.kind)).toEqual(['dock', 'stair', 'dock']);
	expect(graph.edges.map((e) => e.from)).toEqual(['sill', graph.edges[0].to, graph.edges[1].to]);
	expect(graph.edges[2].to).toBe('lane');
});

test('a flight with a missing partner at either end is pruned', () => {
	const a = port('top', 'stair', 0, 2, Math.PI, ['entrance']);
	const b = port('foot', 'stair', 5, 0, 0, ['path']);
	const graph = movementNetwork(
		[exit, a, b],
		[{ id: 'flight', kind: 'stair', from: a.id, to: b.id, mode: 'walk', capacity: 40 }],
		[]
	);
	expect(graph.edges).toEqual([]);
	expect(graph.ports.map((p) => p.id)).toEqual(['sill']);
	const high = { ...exit, position: [0, 0, 2] as const };
	const attached = movementNetwork(
		[high, a, b],
		[{ id: 'flight', kind: 'stair', from: a.id, to: b.id, mode: 'walk', capacity: 40 }],
		[{ id: 'top-joint', from: high.id, to: a.id, profile }]
	);
	expect(attached.edges).toEqual([]);
	expect(attached.unresolved).toEqual(['top-joint']);
});

test('a walkway boards monorail only through its station', () => {
	const walk = port('deck', 'walkway', 0, 0, 0, ['station']);
	const station = port('platform', 'station', 0, 0, Math.PI, ['walkway']);
	const rail = port('next', 'monorail', 100, 0, Math.PI, ['station']);
	const graph = movementNetwork(
		[walk, station, rail],
		[
			{
				id: 'service',
				kind: 'monorail',
				from: station.id,
				to: rail.id,
				mode: 'rail',
				capacity: 160
			}
		],
		[{ id: 'board', from: walk.id, to: station.id, profile }]
	);
	expect(graph.edges.map((e) => [e.from, e.to, e.mode])).toEqual([
		['platform', 'next', 'rail'],
		['deck', 'platform', 'walk']
	]);
	expect(connection(walk, rail).edges).toEqual([]);
});

test('a ground path meets the surveyed tunnel mouth at its level and orientation', () => {
	const mouth = port('portal', 'tunnel', 5, 0, 0, ['path']);
	expect(connection(mouth, path).edges[0].kind).toBe('dock');
	expect(connection({ ...mouth, heading: Math.PI }, path).edges).toEqual([]);
	expect(connection({ ...mouth, headroom: 1 }, path).edges).toEqual([]);
});
