import assert from 'node:assert/strict';
import { test } from 'node:test';
import init, { type Vec2 } from 'manifold-3d';
import { createRoofBuilder } from '../building-envelope';
import { roofBlocks } from './roof-blocks';

test('every roof base triangle lies within its rendered top slab on all four free blocks', async () => {
	const kernel = await init();
	kernel.setup();
	const roofs = roofBlocks(
		createRoofBuilder(kernel, (_id, error) => {
			throw error;
		})
	)[1].primitives;
	const blocks = new Set<string>();
	for (const roof of roofs) {
		if (roof.kind !== 'mesh') continue;
		const mass = roof.id.slice(0, -':roof'.length);
		const seat = roofs.filter((p) => p.id.startsWith(mass + ':tier')).at(-1);
		assert.ok(seat?.kind === 'prism');
		const base = seat.z + seat.height;
		const plan = new kernel.CrossSection([seat.polygon, ...(seat.holes ?? [])], 'EvenOdd');
		// Allow 20 micrometres for clipping and Float32 shell extraction.
		const support = plan.offset(0.00002, 'Miter');
		let faces = 0;
		try {
			for (let i = 0; i < roof.triangles.length; i += 3) {
				const triangle = roof.triangles.slice(i, i + 3).map((index) => roof.points[index]);
				if (!triangle.every((p) => Math.abs(p[2] - base) < 1e-5)) continue;
				faces++;
				const face = new kernel.CrossSection(
					triangle.map(([x, y]): Vec2 => [x, y]),
					'EvenOdd'
				);
				const outside = face.subtract(support);
				try {
					assert.ok(outside.area() < 1e-9, roof.id);
				} finally {
					outside.delete();
					face.delete();
				}
			}
			assert.ok(faces > 0, roof.id);
			blocks.add(mass.split('/')[0]);
		} finally {
			support.delete();
			plan.delete();
		}
	}
	assert.equal(blocks.size, 4);
});

test('a failed or empty roof keeps its exact fallback lines while other houses finish', async () => {
	const kernel = await init();
	kernel.setup();
	const failures: string[] = [];
	const builder = createRoofBuilder(kernel, (id) => failures.push(id));
	const legacy = roofBlocks()[1].primitives;
	let calls = 0;
	const result = roofBlocks({
		...builder,
		build(cell, seat) {
			calls++;
			if (calls === 1) throw new Error('extraction failed');
			if (calls === 2) return { kind: 'mesh', points: [], triangles: [], lines: [] };
			return builder.build(cell, seat);
		}
	})[1].primitives;
	assert.equal(failures.length, 2);
	for (const id of failures) {
		const prefix = id.slice(0, -4);
		const expected = legacy.filter((p) => p.kind === 'polyline' && p.id.startsWith(prefix));
		assert.equal(expected.length, 3);
		assert.deepEqual(
			result.filter((p) => expected.some((e) => e.id === p.id)),
			expected
		);
	}
	assert.equal(result.filter((p) => p.kind === 'mesh').length, calls - 2);
});
