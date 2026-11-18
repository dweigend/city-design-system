import { test } from 'node:test';
import assert from 'node:assert/strict';
import init, { type Vec2 } from 'manifold-3d';
import { hash } from '../hash-random';
import {
	buildEnvelope,
	offsetFootprint,
	roundFootprint,
	type EnvelopeMesh,
	type Roof,
	type BuildingCell
} from './index';
const kernel = await init();
kernel.setup();
function cross(a: Vec2, b: Vec2, c: Vec2) {
	return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function simple(ring: Vec2[]) {
	for (let i = 0; i < ring.length; i++)
		for (let j = i + 2; j < ring.length; j++) {
			if (i === 0 && j === ring.length - 1) continue;
			const a = ring[i],
				b = ring[(i + 1) % ring.length],
				c = ring[j],
				d = ring[(j + 1) % ring.length];
			if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
		}
	return true;
}
function closed(mesh: EnvelopeMesh) {
	const edges = new Map<string, number[]>();
	for (let i = 0; i < mesh.indices.length; i++) {
		const a = mesh.indices[i],
			b = mesh.indices[i - (i % 3) + ((i + 1) % 3)];
		const key = [Math.min(a, b), Math.max(a, b)].join('/');
		edges.set(key, [...(edges.get(key) ?? []), Math.sign(b - a)]);
	}
	return edges.size > 0 && [...edges.values()].every((v) => v.length === 2 && v[0] * v[1] === -1);
}
const roofs: Roof[] = ['gable', 'shed', 'hip', 'sawtooth'];
function star(seed: number): Vec2[] {
	const n = 5 + (seed % 7);
	return Array.from({ length: n }, (_, i) => {
		const r = 2 + 8 * hash(seed, i, 0),
			angle = (i * 2 * Math.PI) / n;
		return [r * Math.cos(angle), r * Math.sin(angle)];
	});
}
for (const seed of Array.from({ length: 30 }, (_, i) => i)) {
	test('closed oriented shell and simple fillets for radial cell ' + seed, () => {
		const polygon = star(seed);
		assert.equal(simple(roundFootprint(polygon, 100)), true);
		const cell: BuildingCell = {
			polygon,
			roof: roofs[seed % 4],
			grade: [0.15, -0.08],
			params: { direction: seed / 7 },
			storeys: [{}, { offset: seed % 2 ? 0.3 : -0.35, radius: seed % 5 === 0 ? 0.4 : 0 }]
		};
		const mesh = buildEnvelope(kernel, [cell]);
		assert.equal(closed(mesh), true);
		positiveAreas(mesh);
		assert.equal(mesh.positions.every(Number.isFinite), true);
		assert.deepEqual(buildEnvelope(kernel, [cell]), mesh);
	});
}
for (const roof of roofs) {
	test(roof + ' closes an acute sliver and a split inset', () => {
		const sliver: Vec2[] = [
			[0, 0],
			[30, 0],
			[0.005, 0.015],
			[0, 0]
		];
		const neck: Vec2[] = [
			[0, 0],
			[4, 0],
			[4, 1.8],
			[7, 1.8],
			[7, 0],
			[11, 0],
			[11, 4],
			[7, 4],
			[7, 2.2],
			[4, 2.2],
			[4, 4],
			[0, 4]
		];
		for (const polygon of [sliver, neck]) {
			if (polygon === neck) assert.equal(offsetFootprint(kernel, neck, -0.3).length, 2);
			const floor = polygon === neck ? { offset: -0.3 } : {};
			assert.ok(closed(buildEnvelope(kernel, [{ polygon, roof, storeys: [{}, floor] }])));
		}
	});
}
test('unequal adjacent roofs keep only the exposed step above the lower roof', () => {
	const left: BuildingCell = {
		polygon: [
			[0, 0],
			[6, 0],
			[6, 6],
			[0, 6]
		],
		roof: 'gable',
		params: { pitch: 0 }
	};
	const right: BuildingCell = {
		...left,
		polygon: [
			[6, 0],
			[12, 0],
			[12, 6],
			[6, 6]
		],
		storeys: [{ height: 5 }]
	};
	const mesh = buildEnvelope(kernel, [left, right]);
	let area = 0;
	for (let i = 0; i < mesh.indices.length; i += 3) {
		const tri = Array.from(mesh.indices.slice(i, i + 3), (n) =>
			mesh.positions.slice(3 * n, 3 * n + 3)
		);
		if (tri.every((p) => p[0] === 6)) {
			const [a, b, c] = tri;
			assert.ok(tri.every((p) => p[2] >= 3));
			area += Math.abs((b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1])) / 2;
		}
	}
	assert.equal(area, 12);
	assert.ok(closed(mesh));
});

function positiveAreas(mesh: EnvelopeMesh) {
	for (let i = 0; i < mesh.indices.length; i += 3) {
		const [a, b, c] = Array.from(mesh.indices.subarray(i, i + 3), (id) =>
			mesh.positions.subarray(id * 3, id * 3 + 3)
		);
		const u = Array.from(b, (v, j) => v - a[j]),
			v = Array.from(c, (w, j) => w - a[j]);
		const area =
			Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) /
			2;
		assert.ok(area > 1e-14);
	}
}
test('shallow hips retain positive faces and closed edges through Float32 extraction', () => {
	const polygon: Vec2[] = [
		[0, 0],
		[4, 0],
		[4, 4],
		[0, 4]
	];
	for (let seed = 0; seed < 40; seed++) {
		const pitch = seed === 0 ? 1e-9 : 10 ** (-12 + 11 * hash(seed, 0, 2));
		const mesh = buildEnvelope(kernel, [
			{ polygon, roof: 'hip', params: { pitch, direction: 2 * hash(seed, 1, 2) } }
		]);
		assert.ok(closed(mesh));
		positiveAreas(mesh);
		if (seed === 0) assert.equal(Math.max(...mesh.positions.filter((_, i) => i % 3 === 2)), 3);
	}
});
test('tall world datums preserve centimetre storeys in their local frame', () => {
	for (const base of [1e6, 4e38]) {
		const mesh = buildEnvelope(kernel, [
			{
				polygon: [
					[0, 0],
					[4, 0],
					[4, 4],
					[0, 4]
				],
				base,
				roof: 'shed',
				params: { pitch: 0 },
				storeys: [{ height: 0.01 }]
			}
		]);
		assert.equal(mesh.origin[2], base);
		assert.ok(Math.abs(Math.max(...mesh.positions.filter((_, i) => i % 3 === 2)) - 0.01) < 1e-8);
		assert.ok(closed(mesh));
		positiveAreas(mesh);
	}
});

test('hips on both sides of local extraction precision export closed positive-area faces', () => {
	const square: Vec2[] = [
		[0, 0],
		[4, 0],
		[4, 4],
		[0, 4]
	];
	const concave: Vec2[] = [
		[0, 0],
		[8, 0],
		[8, 4],
		[3, 4],
		[3, 6],
		[0, 6]
	];
	for (const polygon of [square, concave]) {
		for (const direction of [0, 0.25, Math.PI / 2]) {
			for (const pitch of [
				0,
				Number.EPSILON,
				1e-7,
				...Array.from({ length: 65 }, (_, i) => 10 ** (-12 + i / 8))
			]) {
				const mesh = buildEnvelope(kernel, [
					{ polygon, roof: 'hip', params: { direction, pitch } }
				]);
				assert.ok(closed(mesh));
				positiveAreas(mesh);
				const peak = Math.max(...mesh.positions.filter((_, i) => i % 3 === 2));
				if (pitch === 1e-4) assert.ok(peak > 3);
			}
		}
	}
});

test('rounded 4 m sawtooth exports a closed shell with three teeth', () => {
	const polygon: Vec2[] = [
		[0, 0],
		[4, 0],
		[4, 4],
		[0, 4]
	];
	const mesh = buildEnvelope(kernel, [
		{
			polygon,
			roof: 'sawtooth',
			params: { direction: 0.13, pitch: 0.55 },
			storeys: [{ radius: 0.25 }]
		}
	]);
	assert.ok(closed(mesh));
	positiveAreas(mesh);
	assert.equal(mesh.shellIndexEnds.length, 1);
	const across = (x: number, y: number) => -x * Math.sin(0.13) + y * Math.cos(0.13);
	const span = roundFootprint(polygon, 0.25).map(([x, y]) => across(x, y));
	const low = Math.min(...span),
		step = (Math.max(...span) - low) / 3;
	const peak = 3 + step * Math.tan(0.55);
	const ridges: number[] = [];
	for (let i = 0; i < mesh.positions.length; i += 3) {
		if (Math.abs(mesh.positions[i + 2] - peak) < 1e-5)
			ridges.push(across(mesh.positions[i], mesh.positions[i + 1]));
	}
	for (const tooth of [1, 2, 3])
		assert.ok(ridges.some((r) => Math.abs(r - (low + tooth * step)) < 1e-5));
});

for (const roof of roofs) {
	test('rounded seeded footprints export closed ' + roof + ' roofs', () => {
		for (let seed = 0; seed < 32; seed++) {
			const polygon = star(seed),
				direction = hash(seed, 2, 0) * Math.PI,
				pitch = 0.25 + 0.6 * hash(seed, 3, 0);
			const radius = 0.1 + hash(seed, 4, 0);
			const mesh = buildEnvelope(kernel, [
				{ polygon, roof, params: { direction, pitch }, storeys: [{ radius }] }
			]);
			assert.equal(mesh.shellIndexEnds.length, 1, 'seed ' + seed);
			assert.ok(closed(mesh));
			positiveAreas(mesh);
		}
	});
}
