import { expect, test } from 'bun:test';
import { materialSettings } from '../../../config/material';
import { buildSurface, familyNames, surfaceLevels, type Patch } from './index';

const light = [0.36, 0.48, -1] as const;

const patch: Patch = {
	origin: [0, 0, 0],
	across: [1, 0, 0],
	normal: [0, -1, 0],
	size: [2, 2],
	thickness: 0.1
};

test('relief coarsens to fit an explicit budget', () => {
	const coarse = buildSurface('masonry', { ...patch, size: [4, 3], budget: 400 });
	expect(coarse.moduleScale).toBeGreaterThan(1);
	expect(coarse.triangles).toBeLessThanOrEqual(400);
});

test('every family and level omits geometry below the minimum explicit or default budget', () => {
	for (const family of familyNames) {
		for (const level of surfaceLevels) {
			for (const small of [{ ...patch, budget: 2 }, { ...patch, size: [0.1, 0.1] } as const]) {
				const result = buildSurface(family, small, { level, light });
				expect(result.triangles).toBe(0);
				expect(result.meshes.size).toBe(0);
				expect(result.lines).toEqual([]);
			}
			const minimum = buildSurface(
				family,
				{ ...patch, budget: materialSettings.minimumMeshTriangles },
				{ level }
			);
			expect(minimum.triangles).toBe(materialSettings.minimumMeshTriangles);
		}
	}
});

test('fallback still respects the budget when an opening makes a slab cost more', () => {
	const withOpening: Patch = { ...patch, openings: [[0.5, 0.5, 1.5, 1.5]], budget: 12 };
	for (const level of surfaceLevels) {
		const result = buildSurface('masonry', withOpening, { level });
		expect(result.triangles).toBe(0);
		expect(result.lines).toEqual([]);
	}
});

test('scaled masonry modules that underflow cannot reach a layout', () => {
	for (const level of surfaceLevels)
		expect(() => buildSurface('masonry', patch, { level, moduleScale: 5e-324 })).toThrow(
			/Scaled surface dimensions/
		);
});

test('a kilometer of masonry preflights relief and pencil layouts and flat skips them', () => {
	const kilometer: Patch = { ...patch, size: [1000, 1000] };
	const flat = buildSurface('masonry', kilometer, { level: 'flat' });
	expect(flat.triangles).toBe(12);
	for (const level of ['relief', 'pencil'] as const) {
		const result = buildSurface('masonry', kilometer, { level });
		expect(result.level).toBe('flat');
		expect(result.meshes).toEqual(flat.meshes);
		expect(result.lines).toEqual([]);
		expect(result.moduleScale).toBeGreaterThan(1);
	}
});

test('levels drop from relief to a flat slab to a slab with pencil joints', () => {
	const relief = buildSurface('timber', patch, { light });
	const flat = buildSurface('timber', patch, { level: 'flat' });
	const pencil = buildSurface('timber', patch, { level: 'pencil' });
	expect([...flat.meshes.keys()]).toEqual(['unit']);
	expect(flat.lines).toEqual([]);
	expect(pencil.meshes.get('unit')).toEqual(flat.meshes.get('unit'));
	expect(pencil.lines.length % 6).toBe(0);
	expect(pencil.lines.length).toBeGreaterThan(0);
	expect(flat.triangles).toBeLessThan(relief.triangles);
});
