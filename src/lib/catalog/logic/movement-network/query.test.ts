import { expect, test } from 'bun:test';
import {
	composeMovementGraphs,
	findMovementPath,
	movementNetwork,
	type MovementFragment,
	type MovementKind,
	type MovementPort
} from './index';

function port(
	id: string,
	kind: MovementKind,
	x: number,
	z: number,
	accepts: MovementKind[]
): MovementPort {
	return { id, kind, position: [x, 0, z], heading: 0, width: 2.5, headroom: 3, accepts };
}

function connectedBridgeGraph() {
	const groundStart = port('ground/start', 'path', 0, 0, ['path']);
	const groundHub = port('ground/hub', 'junction', 10, 0, ['path', 'ramp', 'stair']);
	const stairFoot = port('stair/foot', 'stair', 10, 0, ['junction', 'stair']);
	const stairTop = port('stair/top', 'stair', 15, 2, ['bridge', 'stair']);
	const upperLanding = port('upper/landing', 'bridge', 35, 2, ['ramp', 'stair', 'bridge']);
	const upperEnd = port('upper/end', 'entrance', 50, 2, ['bridge']);

	const groundFragment: MovementFragment = {
		ports: [groundStart, groundHub],
		edges: [
			{
				id: 'ground/walk',
				from: 'ground/start',
				to: 'ground/hub',
				kind: 'path',
				mode: 'walk',
				capacity: 150
			}
		]
	};
	const levelFragment: MovementFragment = {
		ports: [stairFoot, stairTop],
		edges: [
			{
				id: 'level/ramp',
				from: 'ground/hub',
				to: 'upper/landing',
				kind: 'ramp',
				mode: 'walk',
				capacity: 150
			},
			{
				id: 'level/stair-dock',
				from: 'ground/hub',
				to: 'stair/foot',
				kind: 'dock',
				mode: 'walk',
				capacity: 150
			},
			{
				id: 'level/stair',
				from: 'stair/foot',
				to: 'stair/top',
				kind: 'stair',
				mode: 'walk',
				capacity: 150
			}
		]
	};
	const upperFragment: MovementFragment = {
		ports: [upperLanding, upperEnd],
		edges: [
			{
				id: 'upper/bridge',
				from: 'upper/landing',
				to: 'upper/end',
				kind: 'bridge',
				mode: 'walk',
				capacity: 150
			}
		]
	};
	const seam = {
		id: 'level/stair-top-link',
		from: 'stair/top',
		to: 'upper/landing',
		kind: 'walkway' as const,
		mode: 'walk' as const,
		capacity: 150
	};
	return {
		graph: composeMovementGraphs([groundFragment, levelFragment, upperFragment], [seam]),
		groundFragment,
		groundStart
	};
}

test('maxGrade captures the steepest centreline segment while grade preserves signed mean slope', () => {
	const a = port('a', 'path', 0, 0, ['path']);
	const b = port('b', 'path', 10, 0, ['path']);
	const c = port('c', 'path', 10, 0, ['path']);
	const graph = movementNetwork(
		[a, b, c],
		[
			{
				id: 'undulating',
				from: 'a',
				to: 'b',
				kind: 'path',
				mode: 'walk',
				capacity: 120,
				via: [[5, 0, 1]]
			},
			{ id: 'zero-dock', from: 'b', to: 'c', kind: 'dock', mode: 'walk', capacity: 120 },
			{
				id: 'vertical-step',
				from: 'a',
				to: 'c',
				kind: 'path',
				mode: 'walk',
				capacity: 120,
				via: [
					[5, 0, 0],
					[5, 0, 1]
				]
			}
		],
		[]
	);
	const byId = new Map(graph.edges.map((e) => [e.id, e]));
	expect(byId.get('undulating')?.grade).toBe(0);
	expect(byId.get('undulating')?.maxGrade).toBeCloseTo(0.2, 9);
	expect(byId.get('zero-dock')?.grade).toBe(0);
	expect(byId.get('zero-dock')?.maxGrade).toBe(0);
	expect(byId.get('vertical-step')?.maxGrade).toBe(Infinity);
});

test('composeMovementGraphs validates fragments and findMovementPath queries ground, ramp, stair and bridge', () => {
	const { graph, groundFragment, groundStart } = connectedBridgeGraph();
	expect(graph.ports.map((p) => p.id)).toEqual([
		'ground/start',
		'ground/hub',
		'stair/foot',
		'stair/top',
		'upper/landing',
		'upper/end'
	]);
	const rampRoute = findMovementPath(graph, 'ground/start', 'upper/end', {
		modes: ['walk'],
		maxGrade: 0.08,
		excludeKinds: ['stair']
	});
	expect(rampRoute?.edgeIds).toEqual(['ground/walk', 'level/ramp', 'upper/bridge']);
	expect(rampRoute?.maxGrade).toBeCloseTo(0.08, 9);

	const stairRoute = findMovementPath(graph, 'ground/start', 'stair/top', { modes: ['walk'] });
	expect(stairRoute?.edgeIds).toEqual(['ground/walk', 'level/stair-dock', 'level/stair']);
	expect(stairRoute?.maxGrade).toBeCloseTo(0.4, 9);

	const reverseRoute = findMovementPath(graph, 'upper/end', 'ground/start', {
		modes: ['walk'],
		excludeKinds: ['stair']
	});
	expect(reverseRoute?.edgeIds).toEqual(['upper/bridge', 'level/ramp', 'ground/walk']);
	expect(reverseRoute?.points[0]).toEqual([50, 0, 2]);
	expect(reverseRoute?.points[reverseRoute.points.length - 1]).toEqual([0, 0, 0]);

	expect(findMovementPath(graph, 'ground/start', 'upper/end', { minWidth: 3 })).toBeUndefined();
	expect(
		findMovementPath(graph, 'ground/start', 'upper/end', { minHeadroom: 3.5 })
	).toBeUndefined();
	expect(findMovementPath(graph, 'ground/start', 'unknown')).toBeUndefined();
	expect(() => findMovementPath(graph, 'ground/start', 'upper/end', { maxGrade: -0.1 })).toThrow(
		RangeError
	);
	expect(() => composeMovementGraphs([groundFragment, { ports: [groundStart] }])).toThrow(
		RangeError
	);
});

test('findMovementPath breaks equal-length ties canonically regardless of edge input order', () => {
	const a = port('a', 'path', 0, 0, ['path']);
	const b = { ...port('b', 'path', 5, 0, ['path']), position: [5, 5, 0] as const };
	const c = { ...port('c', 'path', 5, 0, ['path']), position: [5, -5, 0] as const };
	const d = port('d', 'path', 10, 0, ['path']);
	const edges = [
		{ id: 'e/b1', from: 'a', to: 'b', kind: 'path' as const, mode: 'walk' as const, capacity: 100 },
		{ id: 'e/b2', from: 'b', to: 'd', kind: 'path' as const, mode: 'walk' as const, capacity: 100 },
		{ id: 'e/a1', from: 'a', to: 'c', kind: 'path' as const, mode: 'walk' as const, capacity: 100 },
		{ id: 'e/a2', from: 'c', to: 'd', kind: 'path' as const, mode: 'walk' as const, capacity: 100 }
	];
	const forward = movementNetwork([a, b, c, d], edges, []);
	const reversed = movementNetwork([a, b, c, d], [...edges].reverse(), []);
	expect(findMovementPath(forward, 'a', 'd')?.edgeIds).toEqual(['e/a1', 'e/a2']);
	expect(findMovementPath(reversed, 'a', 'd')?.edgeIds).toEqual(['e/a1', 'e/a2']);
});
