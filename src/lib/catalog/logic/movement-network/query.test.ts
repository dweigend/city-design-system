import { expect, test } from 'bun:test';
import {
	composeMovementGraphs,
	findMovementPath,
	movementNetwork,
	type MovementElement,
	type MovementFragment,
	type MovementKind,
	type MovementPort,
	type Position
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
function walkEdge(
	id: string,
	from: string,
	to: string,
	kind: MovementElement['kind'] = 'path',
	via?: readonly Position[]
): MovementElement {
	return { id, from, to, kind, mode: 'walk', capacity: 150, ...(via ? { via } : {}) };
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
		edges: [walkEdge('ground/walk', 'ground/start', 'ground/hub')]
	};
	const levelFragment: MovementFragment = {
		ports: [stairFoot, stairTop],
		edges: [
			walkEdge('level/ramp', 'ground/hub', 'upper/landing', 'ramp'),
			walkEdge('level/stair-dock', 'ground/hub', 'stair/foot', 'dock'),
			walkEdge('level/stair', 'stair/foot', 'stair/top', 'stair')
		]
	};
	const upperFragment: MovementFragment = {
		ports: [upperLanding, upperEnd],
		edges: [walkEdge('upper/bridge', 'upper/landing', 'upper/end', 'bridge')]
	};
	const seam = walkEdge('level/stair-top-link', 'stair/top', 'upper/landing', 'walkway');
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
			walkEdge('undulating', 'a', 'b', 'path', [[5, 0, 1]]),
			walkEdge('zero-dock', 'b', 'c', 'dock'),
			walkEdge('vertical-step', 'a', 'c', 'path', [
				[5, 0, 0],
				[5, 0, 1]
			])
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
		walkEdge('e/b1', 'a', 'b'),
		walkEdge('e/b2', 'b', 'd'),
		walkEdge('e/a1', 'a', 'c'),
		walkEdge('e/a2', 'c', 'd')
	];
	const forward = movementNetwork([a, b, c, d], edges, []);
	const reversed = movementNetwork([a, b, c, d], [...edges].reverse(), []);
	expect(findMovementPath(forward, 'a', 'd')?.edgeIds).toEqual(['e/a1', 'e/a2']);
	expect(findMovementPath(reversed, 'a', 'd')?.edgeIds).toEqual(['e/a1', 'e/a2']);
});

test('findMovementPath prefers strictly shorter routes over both near ties, including across a dock', () => {
	const p0 = port('p0', 'path', 0, 0, ['path']);
	const p1 = port('p1', 'path', 1, 0, ['path']);
	const p1b = port('p1b', 'path', 1, 0, ['path']);
	const p2 = port('p2', 'path', 2, 0, ['path']);
	const edges = [
		walkEdge('z0', 'p0', 'p1'),
		walkEdge('a0', 'p0', 'p1', 'path', [[0.5, 0.00002, 0]]),
		walkEdge('z1', 'p1', 'p2'),
		walkEdge('a1', 'p1', 'p2', 'path', [[1.5, 0.00002, 0]])
	];
	for (const ordered of [edges, [...edges].reverse()]) {
		const graph = movementNetwork([p0, p1, p2], ordered, []);
		const route = findMovementPath(graph, 'p0', 'p2');
		expect(route?.edgeIds).toEqual(['z0', 'z1']);
		expect(route?.totalLength).toBe(2);
		expect(findMovementPath(graph, 'p2', 'p0')?.edgeIds).toEqual(['z1', 'z0']);
	}

	const dockedEdges = [
		edges[0],
		edges[1],
		walkEdge('d0', 'p1', 'p1b', 'dock'),
		{ ...edges[2], from: 'p1b' },
		{ ...edges[3], from: 'p1b' }
	];
	for (const ordered of [dockedEdges, [...dockedEdges].reverse()]) {
		const graph = movementNetwork([p0, p1, p1b, p2], ordered, []);
		expect(graph.edges.find((edge) => edge.id === 'd0')?.length).toBe(0);
		expect(findMovementPath(graph, 'p0', 'p2')?.edgeIds).toEqual(['z0', 'd0', 'z1']);
		expect(findMovementPath(graph, 'p2', 'p0')?.edgeIds).toEqual(['z1', 'd0', 'z0']);
	}
});

test('findMovementPath preserves unique routes under large-to-small floating-point rounding', () => {
	const p0 = port('p0', 'path', 0, 0, ['path']);
	const p1 = port('p1', 'path', 1e8, 0, ['path']);
	const p2 = { ...port('p2', 'path', 1e8, 0, ['path']), position: [1e8, 1e-8, 0] as const };
	const p3 = { ...port('p3', 'path', 1e8, 0, ['path']), position: [1e8, 2e-8, 0] as const };
	const edges = [
		walkEdge('e0', 'p0', 'p1'),
		walkEdge('e1', 'p1', 'p2'),
		walkEdge('e2', 'p2', 'p3')
	];
	for (const ordered of [edges, [...edges].reverse()]) {
		const graph = movementNetwork([p0, p1, p2, p3], ordered, []);
		const forward = findMovementPath(graph, 'p0', 'p3');
		expect(forward?.edgeIds).toEqual(['e0', 'e1', 'e2']);
		expect(forward?.portIds).toEqual(['p0', 'p1', 'p2', 'p3']);
		expect(forward?.totalLength).toBe(1e8 + 1e-8 + 1e-8);
		const reverse = findMovementPath(graph, 'p3', 'p0');
		expect(reverse?.edgeIds).toEqual(['e2', 'e1', 'e0']);
		expect(reverse?.portIds).toEqual(['p3', 'p2', 'p1', 'p0']);
		expect(reverse?.totalLength).toBe(1e-8 + 1e-8 + 1e8);
	}
});

test('findMovementPath rejects the lexically earlier 4.47e-8 m detour at 1e8 m', () => {
	const ports = [port('start', 'path', 0, 0, ['path']), port('end', 'path', 1e8, 0, ['path'])];
	const edges = [
		walkEdge('z', 'start', 'end'),
		walkEdge('a', 'start', 'end', 'path', [[5e7, 1.5, 0]])
	];
	for (const ordered of [edges, [...edges].reverse()]) {
		const graph = movementNetwork(ports, ordered, []);
		const detour = graph.edges.find((edge) => edge.id === 'a');
		expect(detour?.length).toBe(1e8 + 3 * 2 ** -26);
		expect(findMovementPath(graph, 'start', 'end')?.edgeIds).toEqual(['z']);
		expect(findMovementPath(graph, 'end', 'start')?.edgeIds).toEqual(['z']);
	}
});

test('findMovementPath compares exact sums even when binary64 addition hides the difference', () => {
	const ports = [
		port('start', 'path', 0, 0, ['path']),
		port('end', 'path', 1e8, 0, ['path']),
		{ ...port('long', 'path', 0, 0, ['path']), position: [0, 4e-9, 0] as const },
		{ ...port('short', 'path', 0, 0, ['path']), position: [0, 2e-9, 0] as const }
	];
	const edges = [
		walkEdge('a0', 'start', 'long'),
		walkEdge('a1', 'long', 'end'),
		walkEdge('z0', 'start', 'short'),
		walkEdge('z1', 'short', 'end')
	];
	for (const ordered of [edges, [...edges].reverse()]) {
		const graph = movementNetwork(ports, ordered, []);
		const lengths = new Map(graph.edges.map(({ id, length }) => [id, length]));
		expect(lengths.get('a0')).toBe(4e-9);
		expect(lengths.get('z0')).toBe(2e-9);
		expect(lengths.get('a1')).toBe(1e8);
		expect(lengths.get('z1')).toBe(1e8);
		expect(1e8 + 4e-9).toBe(1e8 + 2e-9);
		expect(findMovementPath(graph, 'start', 'end')?.edgeIds).toEqual(['z0', 'z1']);
		expect(findMovementPath(graph, 'end', 'start')?.edgeIds).toEqual(['z1', 'z0']);
	}
});

test('findMovementPath breaks exact docked ties by edge count and then edge IDs at 1e-8 m', () => {
	const ports = [
		port('start', 'path', 0, 0, ['path']),
		port('end', 'path', 1e-8, 0, ['path']),
		port('a', 'path', 0, 0, ['path']),
		port('z', 'path', 0, 0, ['path'])
	];
	const edges = [
		walkEdge('b0', 'start', 'a', 'dock'),
		walkEdge('b1', 'a', 'end'),
		walkEdge('a0', 'start', 'z', 'dock'),
		walkEdge('z1', 'z', 'end'),
		walkEdge('a-dock', 'a', 'z', 'dock'),
		walkEdge('direct', 'start', 'end', 'ramp')
	];
	for (const ordered of [edges, [...edges].reverse()]) {
		const graph = movementNetwork(ports, ordered, []);
		expect(findMovementPath(graph, 'start', 'end')?.edgeIds).toEqual(['direct']);
		const viaDock = { excludeKinds: ['ramp'] as const };
		expect(findMovementPath(graph, 'start', 'end', viaDock)?.edgeIds).toEqual(['a0', 'z1']);
		expect(findMovementPath(graph, 'end', 'start', viaDock)?.edgeIds).toEqual(['b1', 'b0']);
	}
});

test.each([
	[1e-8, 2e-9],
	[1e8, 2 ** -26]
])('findMovementPath keeps the binary64 filter tolerances at scale %s', (scale, excess) => {
	const ports = [
		{ ...port('start', 'path', 0, 0, ['path']), width: scale, headroom: scale },
		{ ...port('end', 'path', 1, scale, ['path']), width: scale, headroom: scale }
	];
	const graph = movementNetwork(ports, [walkEdge('edge', 'start', 'end')], []);
	expect(
		findMovementPath(graph, 'start', 'end', {
			maxGrade: scale - 0.5e-9,
			minWidth: scale + 0.5e-9,
			minHeadroom: scale + 0.5e-9
		})?.edgeIds
	).toEqual(['edge']);
	for (const query of [
		{ maxGrade: scale - excess },
		{ minWidth: scale + excess },
		{ minHeadroom: scale + excess }
	])
		expect(findMovementPath(graph, 'start', 'end', query)).toBeUndefined();
});
