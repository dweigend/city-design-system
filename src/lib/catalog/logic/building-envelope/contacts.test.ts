import assert from 'node:assert/strict';
import { test } from 'node:test';
import init, { type Vec2 } from 'manifold-3d';
import { buildEnvelope, offsetFootprint, roundFootprint, type BuildingCell } from './index';
const kernel = await init();
kernel.setup();
const square: Vec2[] = [
	[0, 0],
	[4, 0],
	[4, 4],
	[0, 4]
];
function box(x: number, y: number, base = 0): BuildingCell {
	return {
		polygon: square.map(([a, b]) => [a + x, b + y]),
		roof: 'hip',
		params: { pitch: 0 },
		base
	};
}
function assertGeometricClosure(shell: Uint32Array, positions: Float32Array) {
	const edges = new Map<string, number[]>();
	const point = (id: number) => positions.subarray(3 * id, 3 * id + 3).join(',');
	for (let i = 0; i < shell.length; i++) {
		const a = point(shell[i]),
			b = point(shell[i - (i % 3) + ((i + 1) % 3)]);
		const key = [a, b].sort().join('/');
		edges.set(key, [...(edges.get(key) ?? []), a < b ? 1 : -1]);
	}
	for (const directions of edges.values()) assert.deepEqual(directions.sort(), [-1, 1]);
}
test('edge and vertex contacts belong to separate closed shells; face contacts unite', () => {
	for (const other of [box(4, 4), box(4, 4, 3), box(4, 0), box(0, 0, 3)]) {
		const mesh = buildEnvelope(kernel, [box(0, 0), other]);
		const count = other.polygon[0][1] === 4 ? 2 : 1;
		assert.equal(mesh.shellIndexEnds.length, count);
		const assigned = new Set<number>();
		let start = 0;
		for (const end of mesh.shellIndexEnds) {
			const shell = mesh.indices.subarray(start, end);
			for (const id of shell) assert.ok(!assigned.has(id));
			for (const id of shell) assigned.add(id);
			assertGeometricClosure(shell, mesh.positions);
			start = end;
		}
		assert.equal(start, mesh.indices.length);
	}
});
test('all public ring operations reject crossings, nonadjacent touches and retraced edges', () => {
	const rings: Vec2[][] = [
		[
			[0, 0],
			[4, 4],
			[0, 4],
			[4, 0]
		],
		[
			[0, 0],
			[4, 0],
			[4, 4],
			[2, 0],
			[0, 4]
		],
		[
			[0, 0],
			[4, 0],
			[2, 0],
			[4, 4],
			[0, 4]
		]
	];
	for (const polygon of rings) {
		for (const run of [
			() => roundFootprint(polygon, 0.2),
			() => offsetFootprint(kernel, polygon, 0),
			() => buildEnvelope(kernel, [{ ...box(0, 0), polygon }])
		]) {
			assert.throws(run, /Self-intersecting footprint/);
		}
	}
	const collapsed: Vec2[] = [
		[0, 0],
		[1, 0],
		[2, 0]
	];
	assert.deepEqual(roundFootprint(collapsed, 1), []);
	assert.deepEqual(offsetFootprint(kernel, collapsed, 0), []);
	assert.deepEqual(roundFootprint([...square, square[0]], 0), square);
	const clockwise = [...square].reverse();
	assert.deepEqual(roundFootprint(clockwise, 0), square);
});
