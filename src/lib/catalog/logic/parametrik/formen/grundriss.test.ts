import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { formFamily } from './index';
import { cellContext, cellShapes, testCells } from './zellen';
import { area } from './geom';
import { startWahl, turm } from '../../formen/turm';
import { schneidet } from '../../haus-tragwerk/plan';
import type { Point2 } from '../vocab';
import type { Primitive } from '../types';
const barsOf = (parts: Primitive[]) =>
	parts.flatMap((p) =>
		p.kind === 'frame' && p.members ? p.members.map((points) => ({ points })) : []
	);

const families = ['rahmen-plugin', 'rahmen-gitterwuerfel'];
const inside = (poly: Point2[], p: Point2) =>
	poly.every((a, i) => {
		const b = poly[(i + 1) % poly.length];
		return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-6;
	});
function generate(id: string, shape: (typeof cellShapes)[number], seed = 7) {
	const f = formFamily(id);
	assert.ok(f);
	return f.generate(cellContext(shape, seed), { belegung: 1, ausschub: 1 });
}
for (const shape of ['triangle', 'hex', 'irregular'] as const) {
	test(`${shape}: frame reaches every polygon corner; rooms and struts share collision-free cells`, () => {
		for (const id of families)
			for (const seed of [0, 7, 42, 4294967295]) {
				const ctx = cellContext(shape, seed),
					parts = generate(id, shape, seed);
				const bars = barsOf(parts);
				const rooms = parts.filter((p) => p.kind === 'prism');
				assert.ok(bars.length > 0 && rooms.length > 0);
				for (const corner of ctx.footprint)
					assert.ok(
						bars.some((b) =>
							b.points.some((p) => Math.hypot(p[0] - corner[0], p[1] - corner[1]) < 1e-6)
						)
					);
				for (const b of bars)
					for (const p of b.points) assert.ok(inside(ctx.footprint, [p[0], p[1]]));
				for (const r of rooms) {
					assert.ok(area(r.polygon) > 0.01 && r.height > 0);
					assert.ok(r.polygon.every((p) => inside(ctx.footprint, p)));
					for (const b of bars)
						assert.equal(
							schneidet(b.points[0], b.points[1], { polygon: r.polygon, z: r.z, hoeheM: r.height }),
							false
						);
				}
				assert.equal(new Set(parts.map((p) => p.id)).size, parts.length);
			}
	});
}
test('changing the footprint is reversible, seeds are isolated; the tower uses its setback', () => {
	for (const id of families) {
		const before = generate(id, 'square');
		for (const shape of cellShapes) {
			const a = generate(id, shape);
			assert.deepEqual(a, generate(id, shape));
			generate(id, shape, 42);
			assert.deepEqual(a, generate(id, shape));
			const t = turm(
				{ ...startWahl, stapel: { familie: id } },
				{ polygon: testCells[shape].polygon }
			);
			for (const p of barsOf(t.teile[2].primitives))
				for (const v of p.points) assert.ok(inside(t.flaechen.stapel, [v[0], v[1]]));
		}
		assert.deepEqual(before, generate(id, 'square'));
	}
});
test('rectangular cases keep geometry, IDs, order and seed sequence', () => {
	const digest = createHash('sha256')
		.update(
			JSON.stringify(
				families.flatMap((id) => [0, 7, 42].map((seed) => generate(id, 'square', seed)))
			)
		)
		.digest('hex');
	assert.equal(digest, 'f1a3b1ed6f66f7c881214f164f056711651f4460d2113d5568bba51777b1a8c1');
});

test('polygon pull-out moves rooms visibly and keeps their area and shape', () => {
	for (const shape of ['triangle', 'hex', 'irregular'] as const) {
		const f = formFamily('rahmen-plugin');
		assert.ok(f);
		const build = (ausschub: number) =>
			f.generate(cellContext(shape, 7), { belegung: 1, ausschub });
		const a = build(0).filter((p) => p.kind === 'prism');
		const b = build(1).filter((p) => p.kind === 'prism');
		assert.equal(a.length, b.length);
		let largest = 0;
		for (let i = 0; i < a.length; i++) {
			assert.equal(a[i].id, b[i].id);
			assert.ok(Math.abs(area(a[i].polygon) - area(b[i].polygon)) < 1e-7);
			const dx = b[i].polygon[0][0] - a[i].polygon[0][0],
				dy = b[i].polygon[0][1] - a[i].polygon[0][1];
			largest = Math.max(largest, Math.hypot(dx, dy));
			for (let j = 0; j < a[i].polygon.length; j++) {
				assert.ok(Math.abs(b[i].polygon[j][0] - a[i].polygon[j][0] - dx) < 1e-7);
				assert.ok(Math.abs(b[i].polygon[j][1] - a[i].polygon[j][1] - dy) < 1e-7);
			}
		}
		assert.ok(largest > 0.25, `${shape}: visible lift, measured ${largest} m`);
	}
});
