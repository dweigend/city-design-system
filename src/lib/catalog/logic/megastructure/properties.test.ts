import { buildRoofFrame } from './index';
import { abstandZurWand } from '../haus-tragwerk';
import type { Vec3 } from '../traeger';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { dockModule, infrastructurePlate, routeSlope } from './index';
test('rotated modules refuse overlap and penetrating members', () => {
	for (let i = 0; i < 60; i++) {
		const socket = {
			point: [0, 0, 3],
			normal: [0, 0, 1],
			tangent: [Math.cos(i), Math.sin(i), 0]
		} as const;
		for (const kind of ['capsule', 'garden', 'solar-ring', 'tank'] as const) {
			const m = dockModule(kind, socket, []);
			assert.ok(m);
			assert.equal(dockModule(kind, socket, [m.bounds]), undefined);
			assert.equal(
				dockModule(kind, socket, [{ a: [0, 0, 0], b: [0, 0, 9], radius: 0.07 }]),
				undefined
			);
			assert.deepEqual(dockModule(kind, socket, []), m);
		}
	}
});
test('ascents and descents meet grade after landing deductions', () => {
	for (let i = 1; i < 80; i++) {
		const graph = {
			points: [
				[0, 0, 0],
				[8, 0, i / 16]
			],
			links: [[0, 1]]
		} as const;
		for (const [start, end] of [
			[0, 1],
			[1, 0]
		]) {
			const route = routeSlope(graph, start, end);
			if (!route) {
				assert.ok(i / 16 > (8 - 1.6) * 0.6);
				continue;
			}
			const f = route.flights[0],
				rise = Math.abs(f.a[2] - f.b[2]);
			assert.ok(rise / f.run <= 0.6);
			if (f.count) {
				const step = (2 * rise + f.run) / f.count;
				assert.ok(step >= 0.59 && step <= 0.65);
			}
		}
	}
});
test('the complete plug-in plate is repeatable and detached', () => {
	const a = infrastructurePlate(),
		b = infrastructurePlate();
	assert.deepEqual(a, b);
	assert.notEqual(a.roofs, b.roofs);
	assert.equal(a.modules.length, 5);
});

test('every member stays in span and every bearing lies on a surveyed wall', () => {
	const plate = infrastructurePlate();
	const walls = plate.roofs.flatMap((roof) =>
		roof.polygon.map((a, i): [Vec3, Vec3] => [
			[...a, roof.height],
			[...roof.polygon[(i + 1) % roof.polygon.length], roof.height]
		])
	);
	for (const span of [11, 12, 13, 14, 15, 16]) {
		const result = buildRoofFrame(plate.roofs, { maxSpan: span });
		assert.ok(result);
		const nodes = new Map(result.structure.knoten.map((n) => [n.id, n.p]));
		for (const s of result.structure.staebe) {
			const a = nodes.get(s.a),
				b = nodes.get(s.b);
			assert.ok(a && b);
			assert.ok(Math.hypot(...a.map((v, j) => v - b[j])) <= span);
		}
		for (const bearing of result.structure.lager) {
			const point = nodes.get(bearing.knotenId);
			assert.ok(point);
			assert.ok(abstandZurWand(point, { koerper: [], wandachsen: walls }) < 1e-8);
		}
	}
});
